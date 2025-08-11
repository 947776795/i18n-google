import { google } from "googleapis";
import type { I18nConfig } from "../types";
import type { CompleteTranslationRecord } from "./TranslationManager";
import { I18nError, I18nErrorType, ErrorHandler } from "../errors/I18nError";
import { Logger } from "../utils/StringUtils";
import { KeyFormat } from "../utils/KeyFormat";

export class GoogleSheetsSync {
  private googleSheets: any;
  private isInitialized: boolean = false;
  private initPromise: Promise<void>;

  constructor(private config: I18nConfig) {
    this.initPromise = this.initGoogleSheets();
  }

  /**
   * 确保初始化完成
   */
  private async ensureInitialized(): Promise<void> {
    await this.initPromise;
  }

  /**
   * 初始化 Google Sheets API
   */
  private async initGoogleSheets(): Promise<void> {
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

      this.isInitialized = true;
      Logger.info("✅ Google Sheets API 初始化成功");
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
   * 从 Google Sheets 同步 CompleteTranslationRecord
   */
  public async syncCompleteRecordFromSheet(): Promise<CompleteTranslationRecord> {
    await this.ensureInitialized();

    if (!this.isInitialized) {
      Logger.info("🔄 Google Sheets 未初始化，返回空翻译");
      return {};
    }

    try {
      // 使用配置的固定范围避免过滤器干扰
      const readRange = this.config.sheetsReadRange || "A1:Z10000";

      Logger.info(
        `🔍 使用配置的固定范围 ${readRange} 读取数据以避免过滤器干扰`
      );

      const response = await this.googleSheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.sheetName}!${readRange}`,
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

      // 检查是否存在mark列
      const markColumnIndex = headers.indexOf("mark");
      const hasMarkColumn = markColumnIndex !== -1;

      if (hasMarkColumn) {
        Logger.info(`🏷️ 检测到远端已存在mark列，位置: ${markColumnIndex}`);
      }

      // 处理每一行数据
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const combinedKey = row[0]; // 格式：[demo/src/components.tsx][Apply Changes]

        if (!combinedKey) continue;

        // 解析组合键: [demo/src/components.tsx][Apply Changes] 或 [app/[local]/page.ts][get_started_by_editing]
        // 使用更精确的正则表达式来处理嵌套的方括号
        const match = combinedKey.match(/^\[(.+)\]\[([^\]]+)\]$/);
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

        // 处理mark字段
        if (
          hasMarkColumn &&
          row[markColumnIndex] !== undefined &&
          row[markColumnIndex] !== ""
        ) {
          const markValue = parseInt(row[markColumnIndex]) || 0;
          completeRecord[modulePath][translationKey].mark = markValue;
        } else {
          // 如果远端没有mark列或值为空，设置默认值0
          completeRecord[modulePath][translationKey].mark = 0;
        }
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
   * 合并两个 CompleteTranslationRecord，远端数据优先
   * 规则：
   * 1. 本地没有的key，远端没有 → 最终同步到远端的也没有
   * 2. 本地有的key，远端也有 → 翻译以远端为主
   * 3. 本地有的key，远端没有 → 同步到远端也要有
   */
  private mergeCompleteRecords(
    localRecord: CompleteTranslationRecord,
    remoteRecord: CompleteTranslationRecord
  ): CompleteTranslationRecord {
    // 以远端记录为基础
    const mergedRecord: CompleteTranslationRecord = { ...remoteRecord };

    // 遍历本地记录，只添加本地有而远端没有的内容
    Object.entries(localRecord).forEach(([modulePath, moduleKeys]) => {
      if (!mergedRecord[modulePath]) {
        // 新模块（本地有，远端没有），直接添加
        mergedRecord[modulePath] = moduleKeys;
      } else {
        // 现有模块，检查每个Key
        Object.entries(moduleKeys).forEach(([key, translations]) => {
          if (!mergedRecord[modulePath][key]) {
            // 新Key（本地有，远端没有），直接添加
            mergedRecord[modulePath][key] = translations;
          }
          // 如果远端也有这个Key，则保持远端的值不变（远端优先）
        });
      }
    });

    return mergedRecord;
  }

  /**
   * 过滤被用户删除的翻译 key
   * 支持两种删除标识格式：
   *  - 组合键：[modulePath][key]
   *  - 纯 key：key（仅用于旧格式，且仅在未提供组合键时才生效，避免误删其他模块同名 key）
   */
  private filterDeletedKeys(
    record: CompleteTranslationRecord,
    deletedKeys: string[]
  ): CompleteTranslationRecord {
    const filteredRecord: CompleteTranslationRecord = {};

    const formattedDeleteSet = new Set<string>();
    const rawDeleteSet = new Set<string>();

    deletedKeys.forEach((k) => {
      const parsed = KeyFormat.parse(k);
      if (parsed) formattedDeleteSet.add(k);
      else rawDeleteSet.add(k);
    });

    const hasFormatted = formattedDeleteSet.size > 0;

    Object.entries(record).forEach(([modulePath, moduleKeys]) => {
      Object.entries(moduleKeys).forEach(([key, translations]) => {
        const combined = KeyFormat.format(modulePath, key);
        const shouldDelete = hasFormatted
          ? formattedDeleteSet.has(combined)
          : rawDeleteSet.has(key);

        if (!shouldDelete) {
          if (!filteredRecord[modulePath]) filteredRecord[modulePath] = {};
          filteredRecord[modulePath][key] = translations as any;
        } else {
          Logger.debug(`🚫 [DEBUG] 过滤用户删除的翻译: ${combined}`);
        }
      });

      if (
        filteredRecord[modulePath] &&
        Object.keys(filteredRecord[modulePath]).length === 0
      ) {
        delete filteredRecord[modulePath];
      }
    });

    return filteredRecord;
  }

  /**
   * 将 CompleteTranslationRecord 同步到 Google Sheets
   * 在推送前会先拉取远端最新数据进行合并
   */
  public async syncCompleteRecordToSheet(
    completeRecord: CompleteTranslationRecord,
    deletedKeys: string[] = []
  ): Promise<void> {
    await this.ensureInitialized(); // 确保初始化完成

    if (!this.isInitialized) {
      Logger.info("🔄 Google Sheets 未初始化，跳过同步");
      return;
    }

    try {
      Logger.info("🔄 开始同步到 Google Sheets，先拉取远端最新数据...");

      // 1. 先拉取远端最新数据
      let remoteRecord: CompleteTranslationRecord = {};
      try {
        remoteRecord = await this.syncCompleteRecordFromSheet();
        Logger.info(
          `✅ 成功拉取远端数据，包含 ${Object.keys(remoteRecord).length} 个模块`
        );
      } catch (error) {
        Logger.error("❌ 同步远端数据时出错，将直接使用本地数据:", error);
        // 如果拉取失败，继续使用本地数据
      }

      // 2. 合并远端和本地数据（本地优先）
      let mergedRecord = this.mergeCompleteRecords(
        completeRecord,
        remoteRecord
      );

      // 2.5 过滤用户删除的键（支持 [modulePath][key] 与旧格式 key）
      if (deletedKeys.length > 0) {
        mergedRecord = this.filterDeletedKeys(mergedRecord, deletedKeys);
        Logger.info(`🚫 已过滤 ${deletedKeys.length} 个用户删除的翻译key`);
      }
      Logger.info(
        `🔀 数据合并完成，最终包含 ${Object.keys(mergedRecord).length} 个模块`
      );

      // 3. 构建表头 - 包含mark列
      const headers = ["key", ...this.config.languages, "mark"];
      const values = [headers];

      // 4. 构建数据行 - 使用合并后的数据
      Object.entries(mergedRecord).forEach(([modulePath, moduleKeys]) => {
        Object.entries(moduleKeys as Record<string, any>).forEach(
          ([translationKey, translations]) => {
            // 第一列格式：[文件路径][固定的翻译key]
            // 使用固定的translationKey，避免因英文翻译变化导致key变化
            const filePath = this.convertModulePathToFilePath(modulePath);
            const uploadKey = `[${filePath}][${translationKey}]`;

            const row = [uploadKey];

            // 其他列保持原有格式：各语言翻译
            this.config.languages.forEach((lang) => {
              row.push(translations[lang] || "");
            });

            // 添加mark值
            row.push((translations.mark ?? 0).toString());

            values.push(row);
          }
        );
      });

      // 计算动态范围
      const dynamicRange = this.calculateRange(headers.length, 10000);

      // 如果数据行数不足 10000，用空白行填充
      const maxRows = this.config.sheetsMaxRows || 10000;
      const targetRowCount = maxRows;
      const currentRowCount = values.length;

      if (currentRowCount < targetRowCount) {
        const emptyRow = new Array(headers.length).fill("");
        const rowsToAdd = targetRowCount - currentRowCount;

        for (let i = 0; i < rowsToAdd; i++) {
          values.push([...emptyRow]);
        }

        Logger.info(
          `📝 用空白行填充到 ${targetRowCount} 行 (添加了 ${rowsToAdd} 行)`
        );
      }

      // 更新 Google Sheets
      await this.googleSheets.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.sheetName}!${dynamicRange}`,
        valueInputOption: "RAW",
        resource: { values },
      });

      Logger.info(
        `✅ 成功同步 ${
          values.length - 1
        } 条翻译到 Google Sheets (包含mark字段，已合并远端数据)`
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
