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
   * @param record 翻译记录
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
   * @param localeMap 语言映射
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
      const localeFile = locale.endsWith('.json') ? locale : `${locale}.json`;
      const translations = localeMap[localeFile] || {};

      // 如果该语言没有翻译，跳过
      if (Object.keys(translations).length === 0) {
        continue;
      }

      // 写入 JSON 文件
      const filePath = path.join(folderPath, localeFile);
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
   * @param record 翻译记录
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
      for (const locale of locales) {
        const localeFile = locale.endsWith('.json') ? locale : `${locale}.json`;
        const localeMap = record[folderName];
        if (localeMap && localeMap[localeFile] && Object.keys(localeMap[localeFile]).length > 0) {
          files.push(path.join(outputDir, folderName, localeFile));
        }
      }
    }

    return files;
  }
}
