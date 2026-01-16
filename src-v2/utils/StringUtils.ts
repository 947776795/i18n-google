/**
 * 字符串处理工具类
 */

import type { I18nConfig } from '../types/config';

/**
 * 字符串处理工具类
 */
export class StringUtils {
  /**
   * 转义正则表达式特殊字符
   */
  static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 检查字符串是否需要翻译（基于标记符号）
   */
  static isTranslatableString(value: string, config: I18nConfig): boolean {
    const { startMarker, endMarker } = config;
    return (
      value.startsWith(startMarker) &&
      value.endsWith(endMarker) &&
      value.length >= startMarker.length + endMarker.length
    );
  }

  /**
   * 格式化字符串：去掉开始和结尾的标记符号
   */
  static formatString(value: string, config: I18nConfig): string {
    const { startMarker, endMarker } = config;
    const startRegex = new RegExp(`^${this.escapeRegex(startMarker)}+`);
    const endRegex = new RegExp(`${this.escapeRegex(endMarker)}+$`);
    return value.replace(startRegex, '').replace(endRegex, '');
  }

  /**
   * 清理提取的文本：去除前后空格、换行符，并规范化内部空白字符
   */
  static cleanExtractedText(text: string): string {
    return text
      .replace(/^\s+/, '') // 去除开头的所有空白字符（包括空格、换行符、制表符等）
      .replace(/\s+$/, '') // 去除结尾的所有空白字符
      .replace(/\s+/g, ' '); // 将内部的多个连续空白字符替换为单个空格
  }

  /**
   * 检查字符串是否包含英文字符
   */
  static containsEnglishCharacters(text: string): boolean {
    // 检查是否包含英文字母（a-z, A-Z）
    return /[a-zA-Z]/.test(text);
  }

  /**
   * 生成翻译键
   */
  static generateTranslationKey(filePath: string, text: string): string {
    // 新实现：直接使用原文案作为key
    return text;
  }

  /**
   * 生成哈希翻译键（保留作为备用方法）
   */
  static generateHashTranslationKey(filePath: string, text: string): string {
    const crypto = require('crypto');
    const locationString = JSON.stringify({ path: filePath, text });
    const hash = crypto
      .createHash('md5')
      .update(locationString)
      .digest('hex')
      .slice(0, 8);

    return hash;
  }
}
