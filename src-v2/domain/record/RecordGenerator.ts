/**
 * Domain - Record Module
 * 记录生成器 - 收集所有翻译，生成 i18n-complete-record.json
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * 翻译记录数据结构
 * 三层结构：folderName -> locale -> key-value
 */
export interface TranslationRecord {
  [folderName: string]: LocaleTranslations;
}

/**
 * 语言翻译映射
 */
export interface LocaleTranslations {
  [localeFile: string]: KeyTranslations;
}

/**
 * 键值对翻译
 */
export interface KeyTranslations {
  [key: string]: string;
}

/**
 * 记录统计信息
 */
export interface RecordStats {
  totalFolders: number;
  totalKeys: number;
  folderBreakdown: Record<string, number>;
}

/**
 * 记录生成器
 *
 * 职责：收集所有翻译，生成 i18n-complete-record.json
 */
export class RecordGenerator {
  /**
   * 内部记录存储
   */
  private record: TranslationRecord = {};

  /**
   * 添加一条翻译
   *
   * @param folderName 文件夹名称 (如 "app", "app_sub1")
   * @param locale 语言代码 (如 "en", "ko")
   * @param key 翻译键
   * @param value 翻译值
   */
  add(folderName: string, locale: string, key: string, value: string): void {
    // 确保 folderName 存在
    if (!this.record[folderName]) {
      this.record[folderName] = {};
    }

    // 转换 locale 为文件名 (如 "en" -> "en.json")
    const localeFile = locale.endsWith('.json') ? locale : `${locale}.json`;

    // 确保 localeFile 存在
    if (!this.record[folderName][localeFile]) {
      this.record[folderName][localeFile] = {};
    }

    // 添加翻译（已存在则覆盖）
    this.record[folderName][localeFile][key] = value;
  }

  /**
   * 批量添加翻译
   *
   * @param folderName 文件夹名称
   * @param locale 语言代码
   * @param keyValues 翻译键值对
   */
  addBatch(folderName: string, locale: string, keyValues: Record<string, string>): void {
    for (const [key, value] of Object.entries(keyValues)) {
      this.add(folderName, locale, key, value);
    }
  }

  /**
   * 获取记录对象
   *
   * @returns 完整翻译记录
   */
  generate(): TranslationRecord {
    return this.record;
  }

  /**
   * 保存完整记录到文件
   *
   * @param filePath 文件路径 (如 "./src/translate/i18n-complete-record.json")
   */
  async saveCompleteRecord(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);

    // 确保目录存在
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 写入 JSON 文件
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(this.record, null, 2),
      'utf-8'
    );
  }

  /**
   * 获取统计信息
   *
   * @returns 统计信息对象
   */
  getStats(): RecordStats {
    let totalKeys = 0;
    const folderBreakdown: Record<string, number> = {};

    for (const [folderName, localeMap] of Object.entries(this.record)) {
      let folderKeyCount = 0;

      // 合并所有 locale 的 key 数量（去重）
      const allKeys = new Set<string>();
      for (const localeFile of Object.keys(localeMap)) {
        const keys = Object.keys(localeMap[localeFile]);
        keys.forEach(k => allKeys.add(k));
      }

      folderKeyCount = allKeys.size;
      folderBreakdown[folderName] = folderKeyCount;
      totalKeys += folderKeyCount;
    }

    return {
      totalFolders: Object.keys(this.record).length,
      totalKeys,
      folderBreakdown,
    };
  }

  /**
   * 清空记录
   */
  clear(): void {
    this.record = {};
  }

  /**
   * 检查记录是否为空
   *
   * @returns 是否为空
   */
  isEmpty(): boolean {
    return Object.keys(this.record).length === 0;
  }
}
