/**
 * Google Sheets 同步模块
 * 职责：与 Google Sheets 进行翻译数据同步
 */

import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { I18nConfig } from '../../types/config';
import { TranslationRecord, LocaleTranslations } from '../../types/record';

/**
 * Google Sheets 数据格式
 */
interface SheetData {
  values: string[][];
  headers: string[];
}

/**
 * Google Sheets 同步器
 */
export class GoogleSheetsSync {
  private googleSheets: any = null;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(private config: I18nConfig) {
    this.initPromise = this.initGoogleSheets();
  }

  /**
   * 确保初始化完成
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }
  }

  /**
   * 初始化 Google Sheets API
   */
  private async initGoogleSheets(): Promise<void> {
    // 检查 keyFile 是否存在
    const keyFilePath = path.resolve(process.cwd(), this.config.keyFile);
    if (!fs.existsSync(keyFilePath)) {
      console.warn(`⚠️ Google Sheets keyFile 不存在: ${keyFilePath}`);
      this.isInitialized = false;
      return;
    }

    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: keyFilePath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const authClient = await auth.getClient();
      this.googleSheets = google.sheets({
        version: 'v4',
        auth: authClient as any,
      });

      this.isInitialized = true;
      console.log('✅ Google Sheets API 初始化成功');
    } catch (error) {
      console.warn(`⚠️ Google Sheets API 初始化失败: ${error}`);
      this.isInitialized = false;
    }
  }

  /**
   * 从 Google Sheets 拉取远端翻译
   * @returns 翻译记录
   */
  async pull(): Promise<TranslationRecord> {
    await this.ensureInitialized();

    if (!this.isInitialized) {
      console.log('🔄 Google Sheets 未初始化，返回空数据');
      return {};
    }

    const remoteData = await this.readFromSheets();
    return this.remoteToLocal(remoteData);
  }

  /**
   * 增量推送：先拉取最新远端，合并后再推送
   *
   * 用于避免并发冲突：在用户确认删除期间，远端可能有新的更新
   *
   * @param record 本地准备推送的记录
   * @param deletedKeys 已删除的 keys
   */
  async pushWithMerge(record: TranslationRecord, deletedKeys: string[] = []): Promise<void> {
    await this.ensureInitialized();

    if (!this.isInitialized) {
      console.log('🔄 Google Sheets 未初始化，跳过推送');
      return;
    }

    console.log('📥 推送前再次拉取远端最新数据...');
    // 1. 先拉取远端最新数据
    const latestRemote = await this.pull();

    // 2. 合并（远端优先，但保留本地的新增）
    const merged = this.mergeForPush(latestRemote, record);

    // 3. 推送合并后的结果
    const remoteData = this.localToRemote(merged, deletedKeys);
    await this.writeToSheets(remoteData);
  }

  /**
   * 推送翻译到 Google Sheets
   * @param record 翻译记录
   * @param deletedKeys 已删除的 keys
   */
  async push(record: TranslationRecord, deletedKeys: string[] = []): Promise<void> {
    await this.ensureInitialized();

    if (!this.isInitialized) {
      console.log('🔄 Google Sheets 未初始化，跳过推送');
      return;
    }

    // 转换为远端格式
    const remoteData = this.localToRemote(record, deletedKeys);

    // 写入远端
    await this.writeToSheets(remoteData);
  }

  /**
   * 从 Google Sheets 读取数据
   * @returns 远端数据格式
   */
  private async readFromSheets(): Promise<Record<string, Record<string, string>>> {
    const readRange = this.config.sheetsReadRange || 'A1:Z10000';
    const range = `${this.config.sheetName}!${readRange}`;

    try {
      console.log(`📖 读取 Google Sheets: ${range}`);
      const response = await this.googleSheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range,
      });

      const values = response.data.values || [];
      console.log(`✅ 读取了 ${values.length} 行数据`);

      // 解析为远端格式
      const result: Record<string, Record<string, string>> = {};
      const headers = values[0] || [];

      // 找到语言列的索引
      const langIndices = new Map<string, number>();
      this.config.languages.forEach((lang, index) => {
        const colIndex = headers.indexOf(lang);
        if (colIndex !== -1) {
          langIndices.set(lang, colIndex);
        }
      });

      // 解析每一行
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const combinedKey = row[0]; // 格式：[filePath][key]

        if (!combinedKey) continue;

        // 解析组合键
        const match = combinedKey.match(/^\[(.+)\]\[([^\]]+)\]$/);
        if (!match) continue;

        const [, filePath, key] = match;

        // 收集各语言翻译
        const translations: Record<string, string> = {};
        langIndices.forEach((colIndex, lang) => {
          const value = row[colIndex];
          if (value) {
            translations[lang] = value;
          }
        });

        if (Object.keys(translations).length > 0) {
          result[combinedKey] = translations;
        }
      }

      return result;
    } catch (error) {
      console.error(`❌ 读取 Google Sheets 失败: ${error}`);
      return {};
    }
  }

  /**
   * 写入数据到 Google Sheets
   * @param data 要写入的数据
   */
  private async writeToSheets(data: string[][]): Promise<void> {
    try {
      // 计算范围
      const columnCount = 1 + this.config.languages.length;
      const maxRows = this.config.sheetsMaxRows || 10000;
      const range = `${this.config.sheetName}!A1:${this.calculateColumnLetter(columnCount - 1)}${maxRows}`;

      console.log(`📝 写入 Google Sheets: ${range}, ${data.length} 行`);

      // 填充到最大行数
      while (data.length < maxRows) {
        data.push([]);
      }

      await this.googleSheets.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: { values: data },
      });

      console.log('✅ 写入成功');
    } catch (error) {
      console.error(`❌ 写入 Google Sheets 失败: ${error}`);
      throw error;
    }
  }

  /**
   * 将远端格式转换为本地格式
   * @param remote 远端数据
   * @returns 本地翻译记录（内存格式，locale 为 "en" 等）
   */
  private remoteToLocal(remote: Record<string, Record<string, string>>): TranslationRecord {
    const result: TranslationRecord = {};

    for (const [combinedKey, translations] of Object.entries(remote)) {
      // 解析组合键: [filePath][key]
      const match = combinedKey.match(/^\[(.+)\]\[([^\]]+)\]$/);
      if (!match) continue;

      const [, filePath, key] = match;

      // 转换文件路径为 folderName
      const folderName = this.filePathToFolderName(filePath);

      // 初始化 folder
      if (!result[folderName]) {
        result[folderName] = {};
      }

      // 🔑 为每种语言添加翻译（使用语言代码，而非 "en.json"）
      for (const [locale, value] of Object.entries(translations)) {
        // 确保使用语言代码（移除可能的 .json 后缀）
        const localeCode = locale.endsWith('.json') ? locale.slice(0, -5) : locale;
        if (!result[folderName][localeCode]) {
          result[folderName][localeCode] = {};
        }
        result[folderName][localeCode][key] = value;
      }
    }

    return result;
  }

  /**
   * 将本地格式转换为远端数据格式
   * @param record 本地翻译记录（内存格式，locale 为 "en" 等）
   * @param deletedKeys 已删除的 keys
   * @returns 远端数据格式（二维数组）
   */
  private localToRemote(record: TranslationRecord, deletedKeys: string[] = []): string[][] {
    const deletedSet = new Set(deletedKeys);

    // 构建表头
    const headers = ['key', ...this.config.languages];
    const rows: string[][] = [headers];

    // 遍历所有记录
    for (const [folderName, localeMap] of Object.entries(record)) {
      // 获取该文件夹下的所有 key
      const allKeys = new Set<string>();
      for (const locale of Object.keys(localeMap)) {
        Object.keys(localeMap[locale]).forEach(key => allKeys.add(key));
      }

      // 为每个 key 生成一行
      for (const key of allKeys) {
        const filePath = this.folderNameToFilePath(folderName);
        const combinedKey = `[${filePath}][${key}]`;

        // 检查是否被删除
        if (deletedSet.has(combinedKey)) {
          continue;
        }

        const row = [combinedKey];

        // 添加各语言的翻译
        for (const locale of this.config.languages) {
          // 🔑 确保使用语言代码（移除可能的 .json 后缀）
          const localeCode = locale.endsWith('.json') ? locale.slice(0, -5) : locale;
          const value = localeMap[localeCode]?.[key] || '';
          row.push(value);
        }

        rows.push(row);
      }
    }

    return rows;
  }

  /**
   * 将文件路径转换为 folderName
   * @param filePath 文件路径 (如 "app/page.tsx")
   * @returns folderName (如 "app")
   */
  private filePathToFolderName(filePath: string): string {
    // 移除文件扩展名
    const withoutExt = filePath.replace(/\.(tsx?|jsx?)$/, '');
    // 获取第一部分作为 folderName
    return withoutExt.split('/')[0];
  }

  /**
   * 将 folderName 转换为文件路径
   * @param folderName 文件夹名称
   * @returns 文件路径
   */
  private folderNameToFilePath(folderName: string): string {
    return `${folderName}/page.tsx`;
  }

  /**
   * 合并远端和本地数据用于推送
   *
   * 🔑 设计变更：内存中统一使用语言代码（如 "en"），不再使用 "en.json"
   *
   * 合并策略：远端优先，但保留本地的新增
   * - 如果远端有该 key，使用远端的值
   * - 如果远端没有，本地有，使用本地的值（本地新增）
   *
   * @param remote 远端最新数据（内存格式，locale 为 "en" 等）
   * @param local 本地准备推送的数据（内存格式，locale 为 "en" 等）
   * @returns 合并后的数据（内存格式，locale 为 "en" 等）
   */
  private mergeForPush(
    remote: TranslationRecord,
    local: TranslationRecord
  ): TranslationRecord {
    const result: TranslationRecord = {};

    // 收集所有 folderName
    const allFolders = new Set([
      ...Object.keys(remote),
      ...Object.keys(local),
    ]);

    for (const folderName of allFolders) {
      result[folderName] = {};

      // 收集该文件夹下所有的 locale（语言代码）
      const folderRemotes = remote[folderName] || {};
      const folderLocals = local[folderName] || {};
      const allLocales = new Set([
        ...Object.keys(folderRemotes),
        ...Object.keys(folderLocals),
      ]);

      for (const locale of allLocales) {
        // 🔑 确保使用语言代码（移除可能的 .json 后缀）
        const localeCode = locale.endsWith('.json') ? locale.slice(0, -5) : locale;
        result[folderName][localeCode] = {};

        const remoteKeys = folderRemotes[localeCode] || {};
        const localKeys = folderLocals[localeCode] || {};

        // 收集所有的 key
        const allKeys = new Set([
          ...Object.keys(remoteKeys),
          ...Object.keys(localKeys),
        ]);

        for (const key of allKeys) {
          // 远端优先：如果远端有，使用远端的；否则使用本地的
          if (remoteKeys[key] !== undefined) {
            result[folderName][localeCode][key] = remoteKeys[key];
          } else if (localKeys[key] !== undefined) {
            result[folderName][localeCode][key] = localKeys[key];
          }
        }
      }
    }

    return result;
  }

  /**
   * 计算列字母
   * @param index 列索引（0-based）
   * @returns Excel 列字母 (A, B, ..., Z, AA, ...)
   */
  private calculateColumnLetter(index: number): string {
    let letter = '';
    while (index >= 0) {
      letter = String.fromCharCode(65 + (index % 26)) + letter;
      index = Math.floor(index / 26) - 1;
    }
    return letter;
  }
}
