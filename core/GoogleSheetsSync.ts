import { google } from "googleapis";
import type { I18nConfig } from "../types";
import type { CompleteTranslationRecord } from "./TranslationManager";
import { I18nError, I18nErrorType, ErrorHandler } from "../errors/I18nError";
import { Logger } from "../utils/StringUtils";

export class GoogleSheetsSync {
  private googleSheets: any;
  private isInitialized: boolean = true;

  constructor(private config: I18nConfig) {
    this.initGoogleSheets();
  }

  /**
   * 初始化 Google Sheets API
   */
  private async initGoogleSheets() {
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: this.config.keyFile,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const authClient = await auth.getClient();
      this.googleSheets = google.sheets({
        version: "v4",
        auth: authClient as any,
      });
    } catch (error) {
      Logger.warn("⚠️ Google Sheets API 初始化失败，将使用模拟模式:", error);
      this.isInitialized = false;
      // 在测试环境中提供模拟实现
      this.googleSheets = {
        spreadsheets: {
          values: {
            get: async () => ({ data: { values: [] } }),
            update: async () => ({}),
          },
          get: async () => ({
            data: {
              sheets: [
                {
                  properties: {
                    title: this.config.sheetName,
                    gridProperties: {
                      columnCount: Math.max(
                        this.config.languages.length + 1,
                        26
                      ),
                      rowCount: 1000,
                    },
                  },
                },
              ],
            },
          }),
        },
      };
    }
  }

  /**
   * 计算动态范围字符串
   * @param columnCount 列数
   * @param rowCount 行数
   * @returns 格式化的范围字符串，如 "A1:C100"
   */
  private calculateRange(columnCount: number, rowCount: number = 1000): string {
    // 将列数转换为Excel列标识符 (A, B, C, ..., Z, AA, AB, ...)
    const getColumnLetter = (index: number): string => {
      let letter = "";
      while (index >= 0) {
        letter = String.fromCharCode(65 + (index % 26)) + letter;
        index = Math.floor(index / 26) - 1;
      }
      return letter;
    };

    const lastColumn = getColumnLetter(columnCount - 1);
    return `A1:${lastColumn}${rowCount}`;
  }

  /**
   * 获取 Sheet 的实际范围
   * @returns 包含数据的实际范围
   */
  private async getSheetDimensions(): Promise<{ rows: number; cols: number }> {
    try {
      // 首先获取sheet的基本信息来确定有数据的范围
      const metadataResponse = await this.googleSheets.spreadsheets.get({
        spreadsheetId: this.config.spreadsheetId,
        ranges: [this.config.sheetName],
        includeGridData: false,
      });

      const sheet = metadataResponse.data.sheets?.find(
        (s: any) => s.properties.title === this.config.sheetName
      );

      if (sheet) {
        const gridProperties = sheet.properties.gridProperties;
        return {
          rows: gridProperties.rowCount || 1000, // 默认1000行
          cols: gridProperties.columnCount || 26, // 默认26列(A-Z)
        };
      }

      // 如果无法获取元数据，使用默认值
      return { rows: 1000, cols: 26 };
    } catch (error) {
      Logger.warn("获取Sheet维度失败，使用默认范围:", error);
      return { rows: 1000, cols: 26 }; // 默认范围
    }
  }

  /**
   * 从 Google Sheets 同步 CompleteTranslationRecord
   */
  public async syncCompleteRecordFromSheet(): Promise<CompleteTranslationRecord> {
    if (!this.isInitialized) {
      Logger.info("🔄 Google Sheets 未初始化，返回空翻译");
      return {};
    }

    try {
      // 获取动态范围
      const dimensions = await this.getSheetDimensions();
      const dynamicRange = this.calculateRange(
        dimensions.cols,
        dimensions.rows
      );

      const response = await this.googleSheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.sheetName}!${dynamicRange}`,
      });

      const rows = response.data.values || [];
      const headers = rows[0] || [];
      const langIndices = new Map<string, number>();
      const completeRecord: CompleteTranslationRecord = {};

      // 检查是否有数据
      if (rows.length === 0 || headers.length === 0) {
        Logger.info("Google Sheets 中没有数据，返回空翻译");
        return completeRecord;
      }

      headers.forEach((header: string, index: number) => {
        if (this.config.languages.includes(header)) {
          langIndices.set(header, index);
        }
      });

      // 处理每一行数据
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const combinedKey = row[0]; // 格式：[demo/src/components.tsx][Apply Changes]

        if (!combinedKey) continue;

        // 解析组合键: [demo/src/components.tsx][Apply Changes]
        const match = combinedKey.match(/^\[([^\]]+)\]\[([^\]]+)\]$/);
        if (!match) {
          Logger.warn(`⚠️ 无法解析组合键格式: ${combinedKey}`);
          continue;
        }

        const filePath = match[1]; // demo/src/components.tsx 或 components/Header2.ts
        const translationKey = match[2]; // Apply Changes

        // 兼容新旧格式：
        // 旧格式：[demo/src/components.tsx][Apply Changes]
        // 新格式：[components/Header2.ts][Apply Changes]
        let modulePath: string;
        if (filePath.startsWith("demo/src/")) {
          // 旧格式：需要转换文件路径为模块路径
          modulePath = this.convertFilePathToModulePath(filePath);
        } else {
          // 新格式：直接使用作为模块路径
          modulePath = filePath;
        }

        // 初始化模块
        if (!completeRecord[modulePath]) {
          completeRecord[modulePath] = {};
        }

        // 初始化翻译key
        if (!completeRecord[modulePath][translationKey]) {
          completeRecord[modulePath][translationKey] = {};
        }

        // 收集所有语言的翻译
        langIndices.forEach((index, lang) => {
          if (row[index]) {
            completeRecord[modulePath][translationKey][lang] = row[index];
          }
        });
      }

      Logger.info(
        `✅ 从 Google Sheets 同步了 ${
          Object.keys(completeRecord).length
        } 个模块的翻译数据`
      );
      return completeRecord;
    } catch (error) {
      Logger.error("❌ 从 Google Sheets 同步失败:", error);
      return {};
    }
  }

  /**
   * 将 CompleteTranslationRecord 同步到 Google Sheets
   */
  public async syncCompleteRecordToSheet(
    completeRecord: CompleteTranslationRecord
  ): Promise<void> {
    if (!this.isInitialized) {
      Logger.info("🔄 Google Sheets 未初始化，跳过同步");
      return;
    }

    try {
      const headers = ["key", ...this.config.languages];
      const values = [headers];

      // 构建数据行 - 新格式
      Object.entries(completeRecord).forEach(([modulePath, moduleKeys]) => {
        Object.entries(moduleKeys as Record<string, any>).forEach(
          ([translationKey, translations]) => {
            // 第一列格式：[文件路径][en文案]
            const filePath = this.convertModulePathToFilePath(modulePath);
            const enText = translations["en"] || translationKey; // 优先使用英文翻译，否则使用原key
            const uploadKey = `[${filePath}][${enText}]`;

            const row = [uploadKey];

            // 其他列保持原有格式：各语言翻译
            this.config.languages.forEach((lang) => {
              row.push(translations[lang] || "");
            });

            values.push(row);
          }
        );
      });

      // 计算动态范围
      const dynamicRange = this.calculateRange(headers.length, values.length);

      // 更新 Google Sheets
      await this.googleSheets.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.sheetName}!${dynamicRange}`,
        valueInputOption: "RAW",
        resource: { values },
      });

      Logger.info(
        `✅ 成功同步 ${values.length - 1} 条翻译到 Google Sheets (新格式)`
      );
    } catch (error) {
      this.handleSyncError(error, "向Google Sheets同步CompleteRecord");
    }
  }

  /**
   * 从模块路径转换为文件路径
   * 直接返回模块路径，保持与CompleteRecord中的key格式一致
   * 例如：TestModular.ts → TestModular.ts
   * 例如：page/home.ts → page/home.ts
   * 例如：components/Header2.ts → components/Header2.ts
   */
  private convertModulePathToFilePath(modulePath: string): string {
    // 直接返回模块路径，不进行文件路径转换
    // 这样Google Sheets中的格式就与CompleteRecord中的key保持一致
    return modulePath;
  }

  /**
   * 将文件路径转换为模块路径
   * 例如：demo/src/TestModular.tsx → TestModular.ts
   */
  private convertFilePathToModulePath(filePath: string): string {
    // 移除 demo/src/ 前缀
    let modulePath = filePath.replace(/^demo\/src\//, "");

    // 将文件扩展名从 .tsx/.ts/.jsx/.js 改为 .ts
    modulePath = modulePath.replace(/\.(tsx?|jsx?)$/, ".ts");

    return modulePath;
  }

  /**
   * 处理同步错误
   */
  private handleSyncError(error: any, operation: string): void {
    if (
      (error as any).code === "ENOTFOUND" ||
      (error as any).code === "ECONNREFUSED"
    ) {
      throw ErrorHandler.createNetworkError(operation, error as Error);
    } else if ((error as any).code === 401 || (error as any).code === 403) {
      throw new I18nError(
        I18nErrorType.AUTHENTICATION_ERROR,
        "Google Sheets API 认证失败",
        { originalError: error },
        [
          "检查服务账号密钥文件是否正确",
          "确认Google Sheets API是否已启用",
          "验证Sheet写入权限",
        ]
      );
    } else {
      throw new I18nError(
        I18nErrorType.API_ERROR,
        `${operation}失败`,
        { originalError: error },
        [
          "检查网络连接",
          "确认spreadsheetId是否正确",
          "验证Sheet是否有足够空间",
          "稍后重试操作",
        ],
        true // API错误通常是可恢复的
      );
    }
  }
}
