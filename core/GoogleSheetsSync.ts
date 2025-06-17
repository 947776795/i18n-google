import { google } from "googleapis";
import type { I18nConfig } from "../types";
import type { TranslationData } from "./TranslationManager";
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
   * 从 Google Sheets 同步翻译
   */
  public async syncFromSheet(): Promise<TranslationData> {
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
      const translations: TranslationData = {};

      // 检查是否有数据
      if (rows.length === 0 || headers.length === 0) {
        Logger.info("Google Sheets 中没有数据，返回空翻译");
        return translations;
      }

      headers.forEach((header: string, index: number) => {
        if (this.config.languages.includes(header)) {
          langIndices.set(header, index);
        }
      });

      // 更新翻译
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const key = row[0];

        langIndices.forEach((index, lang) => {
          if (row[index]) {
            if (!translations[lang]) {
              translations[lang] = {};
            }
            translations[lang][key] = row[index];
          }
        });
      }

      return translations;
    } catch (error) {
      Logger.error("❌ 从 Google Sheets 同步失败:", error);
      return {};
    }
  }

  /**
   * 将翻译同步到 Google Sheets
   */
  public async syncToSheet(translations: TranslationData): Promise<void> {
    try {
      const headers = ["key", ...this.config.languages];
      const values = [headers];

      // 构建数据行
      const keys = new Set<string>();
      Object.values(translations).forEach((langTranslations) => {
        Object.keys(langTranslations).forEach((key) => keys.add(key));
      });

      keys.forEach((key) => {
        const row = [key];
        this.config.languages.forEach((lang) => {
          row.push(translations[lang]?.[key] || "");
        });
        values.push(row);
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
    } catch (error) {
      if (
        (error as any).code === "ENOTFOUND" ||
        (error as any).code === "ECONNREFUSED"
      ) {
        throw ErrorHandler.createNetworkError(
          "向Google Sheets同步翻译",
          error as Error
        );
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
          "向Google Sheets写入数据失败",
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
}
