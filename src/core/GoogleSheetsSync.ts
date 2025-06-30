import { google } from "googleapis";
import type { I18nConfig } from "../types";
import type { CompleteTranslationRecord } from "./TranslationManager";
import { I18nError, I18nErrorType, ErrorHandler } from "../errors/I18nError";
import { Logger } from "../utils/StringUtils";

/**
 * 变更集数据结构
 */
interface SheetChangeSet {
  addedRows: SheetRow[]; // 新增的行
  modifiedRows: SheetRow[]; // 修改的行
  deletedKeys: string[]; // 删除的key
}

interface SheetRow {
  key: string; // 组合key: [file][text]
  rowIndex?: number; // 在Google Sheets中的行号
  values: string[]; // 行数据 [key, en, zh-Hans, ko, mark]
}

/**
 * 行锁信息
 */
interface RowLockInfo {
  lockId: string;
  lockedRows: Set<number>;
  lockTimestamp: number;
}

/**
 * 同步选项
 */
interface SyncOptions {
  enableStyleProtection?: boolean;
  maxRetries?: number;
  batchSize?: number;
  retryDelay?: number;
}

/**
 * 并发错误类
 */
class ConcurrencyError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = "ConcurrencyError";
  }
}

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
            append: async () => ({}),
            batchUpdate: async () => ({}),
            clear: async () => ({}),
          },
          batchUpdate: async () => ({}),
          get: async () => ({
            data: {
              sheets: [
                {
                  properties: {
                    title: this.config.sheetName,
                    sheetId: 0,
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
   * 计算数据版本（基于内容的哈希）
   */
  public calculateDataVersion(record: CompleteTranslationRecord): string {
    // 创建稳定的数据指纹
    const sortedKeys = Object.keys(record).sort();
    const dataForHash = sortedKeys
      .map((modulePath) => {
        const moduleKeys = Object.keys(record[modulePath]).sort();
        return moduleKeys
          .map((key) => {
            const translations = record[modulePath][key];
            const sortedLangs = Object.keys(translations).sort();
            return sortedLangs
              .map((lang) => `${lang}:${translations[lang]}`)
              .join("|");
          })
          .join("||");
      })
      .join("|||");

    // 生成哈希
    return this.generateHash(dataForHash);
  }

  /**
   * 计算本地和远端记录之间的变更集
   */
  public calculateChangeSet(
    remoteRecord: CompleteTranslationRecord,
    localRecord: CompleteTranslationRecord
  ): SheetChangeSet {
    const changeSet: SheetChangeSet = {
      addedRows: [],
      modifiedRows: [],
      deletedKeys: [],
    };

    // 构建远端key映射，便于快速查找
    const remoteKeyMap = this.buildKeyMap(remoteRecord);
    const localKeyMap = this.buildKeyMap(localRecord);

    // 1. 检测新增和修改
    for (const [combinedKey, localTranslations] of localKeyMap) {
      if (!remoteKeyMap.has(combinedKey)) {
        // 新增
        changeSet.addedRows.push({
          key: combinedKey,
          values: this.buildRowValues(combinedKey, localTranslations),
        });
      } else {
        // 检查是否修改
        const remoteTranslations = remoteKeyMap.get(combinedKey)!;
        if (this.hasTranslationChanged(localTranslations, remoteTranslations)) {
          changeSet.modifiedRows.push({
            key: combinedKey,
            values: this.buildRowValues(combinedKey, localTranslations),
          });
        }
      }
    }

    // 2. 检测删除
    for (const [combinedKey] of remoteKeyMap) {
      if (!localKeyMap.has(combinedKey)) {
        changeSet.deletedKeys.push(combinedKey);
      }
    }

    return changeSet;
  }

  /**
   * 构建key映射表，提高查找效率
   */
  private buildKeyMap(record: CompleteTranslationRecord): Map<string, any> {
    const keyMap = new Map<string, any>();

    Object.entries(record).forEach(([modulePath, moduleKeys]) => {
      Object.entries(moduleKeys as Record<string, any>).forEach(
        ([translationKey, translations]) => {
          const combinedKey = this.buildCombinedKey(
            modulePath,
            translationKey,
            translations
          );
          keyMap.set(combinedKey, translations);
        }
      );
    });

    return keyMap;
  }

  /**
   * 构建组合键，与现有格式保持一致
   */
  private buildCombinedKey(
    modulePath: string,
    translationKey: string,
    translations: any
  ): string {
    const filePath = this.convertModulePathToFilePath(modulePath);
    const enText = translations["en"] || translationKey;
    return `[${filePath}][${enText}]`;
  }

  /**
   * 检查翻译内容是否发生变更
   */
  private hasTranslationChanged(
    localTranslations: any,
    remoteTranslations: any
  ): boolean {
    // 检查所有语言的翻译
    for (const lang of this.config.languages) {
      if (
        (localTranslations[lang] || "") !== (remoteTranslations[lang] || "")
      ) {
        return true;
      }
    }

    // 检查mark字段
    const localMark = localTranslations.mark ?? 0;
    const remoteMark = remoteTranslations.mark ?? 0;
    if (localMark !== remoteMark) {
      return true;
    }

    return false;
  }

  /**
   * 构建行数据数组
   */
  private buildRowValues(combinedKey: string, translations: any): string[] {
    const row = [combinedKey];

    // 添加各语言翻译
    this.config.languages.forEach((lang) => {
      row.push(translations[lang] || "");
    });

    // 添加mark值
    row.push((translations.mark ?? 0).toString());

    return row;
  }

  /**
   * 检查变更集是否为空
   */
  private isChangeSetEmpty(changeSet: SheetChangeSet): boolean {
    return (
      changeSet.addedRows.length === 0 &&
      changeSet.modifiedRows.length === 0 &&
      changeSet.deletedKeys.length === 0
    );
  }

  /**
   * 记录变更集摘要
   */
  private logChangeSetSummary(changeSet: SheetChangeSet): void {
    Logger.info("📊 变更摘要:");
    Logger.info(`  ➕ 新增: ${changeSet.addedRows.length} 行`);
    Logger.info(`  ✏️ 修改: ${changeSet.modifiedRows.length} 行`);
    Logger.info(`  🗑️ 删除: ${changeSet.deletedKeys.length} 行`);

    const totalChanges =
      changeSet.addedRows.length +
      changeSet.modifiedRows.length +
      changeSet.deletedKeys.length;
    Logger.info(`  📈 总计: ${totalChanges} 项变更`);
  }

  /**
   * 生成简单哈希
   */
  private generateHash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
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
   * 增量同步到Google Sheets（新的主要同步方法）
   */
  public async syncCompleteRecordToSheet(
    completeRecord: CompleteTranslationRecord,
    options: SyncOptions = {}
  ): Promise<void> {
    await this.ensureInitialized();

    if (!this.isInitialized) {
      Logger.info("🔄 Google Sheets 未初始化，跳过同步");
      return;
    }

    try {
      Logger.info("🔄 开始增量同步到 Google Sheets...");

      // 1. 获取远端记录
      const remoteRecord = await this.syncCompleteRecordFromSheet();
      const remoteVersion = this.calculateDataVersion(remoteRecord);

      // 2. 计算变更集
      const changeSet = this.calculateChangeSet(remoteRecord, completeRecord);

      // 3. 检查是否有变更
      if (this.isChangeSetEmpty(changeSet)) {
        Logger.info("✅ 没有检测到变更，跳过同步");
        return;
      }

      this.logChangeSetSummary(changeSet);

      // 4. 应用增量变更（统一使用并发控制）
      await this.applyIncrementalChangesWithConcurrencyControl(
        changeSet,
        remoteVersion,
        options
      );

      Logger.info("✅ 增量同步完成");
    } catch (error) {
      this.handleSyncError(error, "增量同步");
      throw error;
    }
  }

  /**
   * 应用增量变更（带并发控制）
   */
  public async applyIncrementalChangesWithConcurrencyControl(
    changeSet: SheetChangeSet,
    remoteVersion: string,
    options: SyncOptions = {}
  ): Promise<void> {
    const maxRetries = options.maxRetries || 3;
    const baseDelay = options.retryDelay || 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 1. 验证远端版本
        await this.validateRemoteVersion(remoteVersion);

        // 2. 获取行锁
        const lockInfo = await this.acquireRowLocks(changeSet);

        try {
          // 3. 应用变更
          await this.applyIncrementalChangesInternal(changeSet, options);

          // 4. 释放行锁
          await this.releaseRowLocks(lockInfo);

          Logger.info(`✅ 并发控制同步成功 (尝试 ${attempt}/${maxRetries})`);
          return;
        } catch (error) {
          // 确保释放锁
          await this.releaseRowLocks(lockInfo);
          throw error;
        }
      } catch (error) {
        const errorType = this.categorizeError(error);

        if (
          errorType === "VERSION_CONFLICT" ||
          errorType === "CONCURRENCY_ERROR"
        ) {
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt - 1); // 指数退避
            Logger.warn(
              `⚠️ 检测到${
                errorType === "VERSION_CONFLICT" ? "版本冲突" : "并发冲突"
              }，${delay}ms后重试 (${attempt}/${maxRetries})`
            );
            await this.delay(delay);
            continue;
          }
        }

        Logger.error(`❌ 并发控制同步失败: ${error}`);
        throw error;
      }
    }

    throw new ConcurrencyError(`并发控制同步失败，已重试${maxRetries}次`);
  }

  /**
   * 应用增量变更（内部方法）
   */
  private async applyIncrementalChangesInternal(
    changeSet: SheetChangeSet,
    options: SyncOptions = {}
  ): Promise<void> {
    const { enableStyleProtection = true } = options;

    // 串行执行：删除 → 修改 → 新增
    if (changeSet.deletedKeys.length > 0) {
      await this.handleDeletedRows(
        changeSet.deletedKeys,
        enableStyleProtection
      );
    }

    if (changeSet.modifiedRows.length > 0) {
      await this.handleModifiedRows(
        changeSet.modifiedRows,
        enableStyleProtection
      );
    }

    if (changeSet.addedRows.length > 0) {
      await this.handleAddedRows(changeSet.addedRows, enableStyleProtection);
    }
  }

  /**
   * 处理删除的行
   */
  private async handleDeletedRows(
    deletedKeys: string[],
    enableStyleProtection: boolean
  ): Promise<void> {
    Logger.info(`🗑️ 处理 ${deletedKeys.length} 个删除操作...`);

    // 获取当前数据以找到行索引
    const currentData = await this.getCurrentSheetData();
    const rowsToDelete: number[] = [];

    deletedKeys.forEach((key) => {
      const rowIndex = this.findRowIndexByKey(currentData, key);
      if (rowIndex !== -1) {
        rowsToDelete.push(rowIndex);
      }
    });

    if (rowsToDelete.length === 0) {
      Logger.info("没有找到需要删除的行");
      return;
    }

    // 按行号降序排序，从后往前删除避免索引变化
    rowsToDelete.sort((a, b) => b - a);

    if (enableStyleProtection) {
      // 使用batchUpdate安全删除
      const sheetId = await this.getSheetId();
      const requests = rowsToDelete.map((rowIndex) => ({
        deleteDimension: {
          range: {
            sheetId: sheetId,
            dimension: "ROWS",
            startIndex: rowIndex - 1, // 0-based
            endIndex: rowIndex, // exclusive
          },
        },
      }));

      await this.googleSheets.spreadsheets.batchUpdate({
        spreadsheetId: this.config.spreadsheetId,
        requestBody: { requests },
      });
    } else {
      // 简单清空内容
      for (const rowIndex of rowsToDelete) {
        await this.googleSheets.spreadsheets.values.clear({
          spreadsheetId: this.config.spreadsheetId,
          range: `${this.config.sheetName}!A${rowIndex}:Z${rowIndex}`,
        });
      }
    }

    Logger.info(`✅ 删除了 ${rowsToDelete.length} 行`);
  }

  /**
   * 处理修改的行
   */
  private async handleModifiedRows(
    modifiedRows: SheetRow[],
    enableStyleProtection: boolean
  ): Promise<void> {
    Logger.info(`✏️ 处理 ${modifiedRows.length} 个修改操作...`);

    // 获取当前数据以找到行索引
    const currentData = await this.getCurrentSheetData();

    const updateRequests = modifiedRows
      .map((row) => {
        const rowIndex = this.findRowIndexByKey(currentData, row.key);
        if (rowIndex === -1) {
          Logger.warn(`⚠️ 未找到要修改的行: ${row.key}`);
          return null;
        }

        return {
          range: `${this.config.sheetName}!A${rowIndex}:${String.fromCharCode(
            65 + row.values.length - 1
          )}${rowIndex}`,
          values: [row.values],
        };
      })
      .filter(Boolean);

    if (updateRequests.length === 0) {
      Logger.info("没有找到需要修改的行");
      return;
    }

    // 批量更新
    await this.googleSheets.spreadsheets.values.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      requestBody: {
        valueInputOption: enableStyleProtection ? "RAW" : "USER_ENTERED",
        data: updateRequests,
      },
    });

    Logger.info(`✅ 修改了 ${updateRequests.length} 行`);
  }

  /**
   * 处理新增的行
   */
  private async handleAddedRows(
    addedRows: SheetRow[],
    enableStyleProtection: boolean
  ): Promise<void> {
    Logger.info(`➕ 处理 ${addedRows.length} 个新增操作...`);

    const values = addedRows.map((row) => row.values);

    if (enableStyleProtection) {
      // 使用append API保护样式
      await this.googleSheets.spreadsheets.values.append({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.sheetName}!A:A`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values,
        },
      });
    } else {
      // 简单追加
      await this.googleSheets.spreadsheets.values.append({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.sheetName}!A:A`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values,
        },
      });
    }

    Logger.info(`✅ 新增了 ${addedRows.length} 行`);
  }

  /**
   * 获取当前表格数据
   */
  private async getCurrentSheetData(): Promise<string[][]> {
    const readRange = this.config.sheetsReadRange || "A1:Z10000";
    const response = await this.googleSheets.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range: `${this.config.sheetName}!${readRange}`,
    });
    return response.data.values || [];
  }

  /**
   * 根据key查找行索引
   */
  private findRowIndexByKey(data: string[][], key: string): number {
    for (let i = 1; i < data.length; i++) {
      // 跳过标题行
      if (data[i][0] === key) {
        return i + 1; // 返回1-based索引
      }
    }
    return -1;
  }

  /**
   * 获取Sheet ID
   */
  private async getSheetId(): Promise<number> {
    const response = await this.googleSheets.spreadsheets.get({
      spreadsheetId: this.config.spreadsheetId,
    });

    const sheet = response.data.sheets?.find(
      (s: any) => s.properties.title === this.config.sheetName
    );

    return sheet?.properties?.sheetId || 0;
  }

  /**
   * 延迟工具方法
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 验证远端版本
   */
  public async validateRemoteVersion(expectedVersion: string): Promise<void> {
    const currentRecord = await this.syncCompleteRecordFromSheet();
    const currentVersion = this.calculateDataVersion(currentRecord);

    if (currentVersion !== expectedVersion) {
      throw new ConcurrencyError("远端数据版本冲突", {
        expected: expectedVersion,
        current: currentVersion,
      });
    }
  }

  /**
   * 获取行锁
   */
  public async acquireRowLocks(
    changeSet: SheetChangeSet
  ): Promise<RowLockInfo> {
    const lockId = `lock-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const lockedRows = new Set<number>();
    const lockTimestamp = Date.now();

    // 获取需要锁定的行
    const currentData = await this.getCurrentSheetData();

    // 为修改和删除的行获取锁
    changeSet.modifiedRows.forEach((row) => {
      const rowIndex = this.findRowIndexByKey(currentData, row.key);
      if (rowIndex !== -1) {
        lockedRows.add(rowIndex);
      }
    });

    changeSet.deletedKeys.forEach((key) => {
      const rowIndex = this.findRowIndexByKey(currentData, key);
      if (rowIndex !== -1) {
        lockedRows.add(rowIndex);
      }
    });

    // 在隐藏列（Z列）设置锁标记
    const lockRequests = Array.from(lockedRows).map((rowIndex) => ({
      range: `${this.config.sheetName}!Z${rowIndex}`,
      values: [[lockId]],
    }));

    if (lockRequests.length > 0) {
      await this.googleSheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.config.spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: lockRequests,
        },
      });
    }

    return { lockId, lockedRows, lockTimestamp };
  }

  /**
   * 释放行锁
   */
  public async releaseRowLocks(lockInfo: RowLockInfo): Promise<void> {
    const clearRequests = Array.from(lockInfo.lockedRows).map((rowIndex) => ({
      range: `${this.config.sheetName}!Z${rowIndex}`,
      values: [[""]],
    }));

    if (clearRequests.length > 0) {
      await this.googleSheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.config.spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: clearRequests,
        },
      });
    }
  }

  /**
   * 错误类型分类
   */
  private categorizeError(error: any): string {
    const message = error.message || error.toString();

    if (message.includes("版本冲突") || message.includes("数据已被修改")) {
      return "VERSION_CONFLICT";
    }

    if (message.includes("锁定") || message.includes("并发")) {
      return "CONCURRENCY_ERROR";
    }

    if (
      error.code === 429 ||
      message.includes("quota") ||
      message.includes("rate")
    ) {
      return "RATE_LIMIT";
    }

    return "UNKNOWN";
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
