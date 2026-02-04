/**
 * Domain - Record Module
 * 记录生成器 - 收集所有翻译，生成 i18n-complete-record.json
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * 翻译记录数据结构
 * 三层结构：folderName -> locale -> key-value
 *
 * 🔑 设计原则：内存中统一使用语言代码（如 "en", "ko"），
 *   文件名扩展名（.json）仅在生成文件时添加
 */
export interface TranslationRecord {
  [folderName: string]: LocaleTranslations;
}

/**
 * 语言翻译映射
 * key 为语言代码（如 "en", "ko"），而非 "en.json"
 */
export interface LocaleTranslations {
  [locale: string]: KeyTranslations;
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
 *
 * 🔑 设计变更：内存中统一使用语言代码（如 "en"），
 *   文件名扩展名（.json）仅在生成文件时添加
 */
export class RecordGenerator {
  /**
   * 内部记录存储
   * key: 语言代码（如 "en", "ko"），而非 "en.json"
   */
  private record: TranslationRecord = {};

  /**
   * 添加一条翻译
   *
   * @param folderName 文件夹名称 (如 "app", "app_sub1")
   * @param locale 语言代码 (如 "en", "ko")，会自动移除 .json 后缀
   * @param key 翻译键
   * @param value 翻译值
   */
  add(folderName: string, locale: string, key: string, value: string): void {
    // 确保 folderName 存在
    if (!this.record[folderName]) {
      this.record[folderName] = {};
    }

    // 🔑 移除 .json 后缀，确保内存中统一使用语言代码
    const localeCode = locale.endsWith('.json') ? locale.slice(0, -5) : locale;

    // 确保 localeCode 存在
    if (!this.record[folderName][localeCode]) {
      this.record[folderName][localeCode] = {};
    }

    // 添加翻译（已存在则覆盖）
    this.record[folderName][localeCode][key] = value;
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
   * @returns 完整翻译记录（内存格式，locale 为 "en" 等）
   */
  generate(): TranslationRecord {
    return this.record;
  }

  /**
   * 保存完整记录到文件
   *
   * 🔑 保存时保持内存格式（locale 为 "en" 等），不再转换
   *
   * @param filePath 文件路径 (如 "./src/translate/i18n-complete-record.json")
   */
  async saveCompleteRecord(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);

    // 确保目录存在
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 🔑 不再转换键名，直接保存内存格式（locale 为 "en" 等）
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
      for (const locale of Object.keys(localeMap)) {
        const keys = Object.keys(localeMap[locale]);
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
