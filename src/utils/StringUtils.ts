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
   * 清理提取的文本：去除前后空格、换行符，并规范化内部空白字符
   * @param text - 待清理的文本
   * @returns 清理后的文本
   */
  static cleanExtractedText(text: string): string {
    return text
      .replace(/^\s+/, "") // 去除开头的所有空白字符（包括空格、换行符、制表符等）
      .replace(/\s+$/, "") // 去除结尾的所有空白字符
      .replace(/\s+/g, " "); // 将内部的多个连续空白字符替换为单个空格
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
   * @param filePath - 文件路径
   * @param text - 待翻译文本
   */
  static generateTranslationKey(filePath: string, text: string): string {
    // 新实现：直接使用原文案作为key
    return text;
  }

  /**
   * 生成哈希翻译键（保留作为备用方法）
   * @param filePath - 文件路径
   * @param text - 待翻译文本
   */
  static generateHashTranslationKey(filePath: string, text: string): string {
    const locationString = JSON.stringify({ path: filePath, text });
    const hash = crypto
      .createHash("md5")
      .update(locationString)
      .digest("hex")
      .slice(0, 8);

    return hash;
  }
}

/**
 * 日志级别枚举
 */
export enum LogLevel {
  SILENT = 0,
  NORMAL = 1,
  VERBOSE = 2,
}

/**
 * 日志工具类
 */
export class Logger {
  private static logLevel: LogLevel = LogLevel.NORMAL;

  /**
   * 设置日志级别
   */
  static setLogLevel(level: "silent" | "normal" | "verbose") {
    switch (level) {
      case "silent":
        this.logLevel = LogLevel.SILENT;
        break;
      case "normal":
        this.logLevel = LogLevel.NORMAL;
        break;
      case "verbose":
        this.logLevel = LogLevel.VERBOSE;
        break;
    }
  }

  /**
   * 普通信息日志（用户友好的关键信息）
   */
  static info(...args: any[]) {
    if (this.logLevel >= LogLevel.NORMAL) {
      console.log(...args);
    }
  }

  /**
   * 详细调试日志（开发调试用）
   */
  static debug(...args: any[]) {
    if (this.logLevel >= LogLevel.VERBOSE) {
      console.log(...args);
    }
  }

  /**
   * 警告日志
   */
  static warn(...args: any[]) {
    if (this.logLevel >= LogLevel.NORMAL) {
      console.warn(...args);
    }
  }

  /**
   * 错误日志
   */
  static error(...args: any[]) {
    if (this.logLevel >= LogLevel.NORMAL) {
      console.error(...args);
    }
  }

  /**
   * 成功日志
   */
  static success(...args: any[]) {
    if (this.logLevel >= LogLevel.NORMAL) {
      console.log(...args);
    }
  }
}
