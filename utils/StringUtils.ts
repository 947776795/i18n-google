import crypto from "crypto";
import type { I18nConfig } from "../types";

/**
 * 字符串处理工具类
 */
export class StringUtils {
  /**
   * 转义正则表达式特殊字符
   */
  static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    return value.replace(startRegex, "").replace(endRegex, "");
  }

  /**
   * 生成翻译键
   * @param filePath - 文件路径
   * @param text - 待翻译文本
   */
  static generateTranslationKey(filePath: string, text: string): string {
    const locationString = JSON.stringify({ path: filePath, text });
    const hash = crypto
      .createHash("md5")
      .update(locationString)
      .digest("hex")
      .slice(0, 8);

    return hash;
  }
}
