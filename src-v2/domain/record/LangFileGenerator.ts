/**
 * Domain - Record Module
 * 语言文件生成器 - 根据记录生成各语言文件
 */

import * as fs from 'fs';
import * as path from 'path';
import { TranslationRecord } from './RecordGenerator';

/**
 * 语言文件生成器
 *
 * 职责：根据记录生成各语言文件
 *
 * 🔑 设计原则：接收内存格式的记录（locale 为 "en" 等），
 *   生成文件时转换为文件名（"en.json"）
 *
 * 生成的文件结构:
 * ```
 * translate/
 * ├── app/
 * │   ├── en.json
 * │   ├── ko.json
 * │   └── zh-CN.json
 * └── app_sub1/
 *     ├── en.json
 *     └── ko.json
 * ```
 */
export class LangFileGenerator {
  /**
   * 根据记录生成语言文件
   *
   * @param record 翻译记录（内存格式，locale 为 "en" 等）
   * @param outputDir 输出目录 (如 "./src/translate")
   * @param locales 语言列表 (如 ["en", "ko", "zh-CN"])
   */
  async generate(
    record: TranslationRecord,
    outputDir: string,
    locales: string[]
  ): Promise<void> {
    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 遍历每个 folderName
    for (const [folderName, localeMap] of Object.entries(record)) {
      await this.generateFolder(folderName, localeMap, outputDir, locales);
    }
  }

  /**
   * 为单个文件夹生成语言文件
   *
   * @param folderName 文件夹名称 (如 "app", "app_sub1")
   * @param localeMap 语言映射（内存格式，locale 为 "en" 等）
   * @param outputDir 输出目录
   * @param locales 语言列表
   */
  async generateFolder(
    folderName: string,
    localeMap: Record<string, Record<string, string>>,
    outputDir: string,
    locales: string[]
  ): Promise<void> {
    const folderPath = path.join(outputDir, folderName);

    // 确保文件夹目录存在
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // 遍历每个 locale
    for (const locale of locales) {
      // 🔑 从内存格式（locale 可能是 "en" 或 "en.json"）转换为语言代码
      const localeCode = locale.endsWith('.json') ? locale.slice(0, -5) : locale;
      const translations = localeMap[localeCode] || {};

      // 如果该语言没有翻译，跳过
      if (Object.keys(translations).length === 0) {
        continue;
      }

      // 🔑 生成文件名（语言代码 -> 文件名）
      const localeFile = `${localeCode}.json`;
      const filePath = path.join(folderPath, localeFile);

      // 写入 JSON 文件
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(translations, null, 2),
        'utf-8'
      );
    }
  }

  /**
   * 获取生成的文件列表
   *
   * @param record 翻译记录（内存格式，locale 为 "en" 等）
   * @param outputDir 输出目录
   * @param locales 语言列表
   * @returns 生成的文件路径列表
   */
  getGeneratedFiles(
    record: TranslationRecord,
    outputDir: string,
    locales: string[]
  ): string[] {
    const files: string[] = [];

    for (const folderName of Object.keys(record)) {
      const localeMap = record[folderName];
      for (const locale of locales) {
        // 🔑 从内存格式（locale 可能是 "en" 或 "en.json"）转换为语言代码
        const localeCode = locale.endsWith('.json') ? locale.slice(0, -5) : locale;
        const translations = localeMap[localeCode];

        if (translations && Object.keys(translations).length > 0) {
          // 🔑 生成文件名（语言代码 -> 文件名）
          const localeFile = `${localeCode}.json`;
          files.push(path.join(outputDir, folderName, localeFile));
        }
      }
    }

    return files;
  }
}
