/**
 * 日志工具
 */

import type { LogLevel } from "../types";

/**
 * 日志级别优先级
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  silent: 0,
  normal: 1,
  verbose: 2,
};

/**
 * 日志工具类
 */
export class Logger {
  private static currentLevel: LogLevel = "normal";

  /**
   * 设置日志级别
   */
  static setLogLevel(level: LogLevel = "normal"): void {
    this.currentLevel = level;
  }

  /**
   * 获取当前日志级别
   */
  static getLogLevel(): LogLevel {
    return this.currentLevel;
  }

  /**
   * 判断是否应该输出日志
   */
  private static shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[this.currentLevel];
  }

  /**
   * 输出普通日志
   */
  static info(message: string, ...args: unknown[]): void {
    if (this.shouldLog("normal")) {
      console.log(message, ...args);
    }
  }

  /**
   * 输出成功日志
   */
  static success(message: string, ...args: unknown[]): void {
    if (this.shouldLog("normal")) {
      console.log(`✅ ${message}`, ...args);
    }
  }

  /**
   * 输出警告日志
   */
  static warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog("normal")) {
      console.warn(`⚠️  ${message}`, ...args);
    }
  }

  /**
   * 输出错误日志
   */
  static error(message: string, ...args: unknown[]): void {
    if (this.shouldLog("normal")) {
      console.error(`❌ ${message}`, ...args);
    }
  }

  /**
   * 输出调试日志
   */
  static debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog("verbose")) {
      console.log(`🐛 [DEBUG] ${message}`, ...args);
    }
  }

  /**
   * 输出带图标的日志
   */
  static log(icon: string, message: string, ...args: unknown[]): void {
    if (this.shouldLog("normal")) {
      console.log(`${icon} ${message}`, ...args);
    }
  }

  /**
   * 清空控制台
   */
  static clear(): void {
    console.clear();
  }

  /**
   * 输出分隔线
   */
  static separator(char = "=", length = 60): void {
    if (this.shouldLog("normal")) {
      console.log(char.repeat(length));
    }
  }

  /**
   * 输出空行
   */
  static blank(): void {
    if (this.shouldLog("normal")) {
      console.log();
    }
  }
}
