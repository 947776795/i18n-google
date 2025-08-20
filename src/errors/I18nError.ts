import { Logger } from "../utils/StringUtils";

/**
 * 国际化系统错误类型枚举 - 仅保留实际使用的类型
 */
export enum I18nErrorType {
  // 网络和API错误
  API_ERROR = "API_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",

  // 用户操作错误
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",

  // 系统错误
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  INITIALIZATION_ERROR = "INITIALIZATION_ERROR",
  PERMISSION_ERROR = "PERMISSION_ERROR",
}

/**
 * 国际化系统自定义错误类
 */
export class I18nError extends Error {
  constructor(
    public readonly type: I18nErrorType,
    message: string,
    public readonly details?: any,
    public readonly suggestions: string[] = [],
    public readonly isRecoverable: boolean = false
  ) {
    super(message);
    this.name = "I18nError";

    // 确保错误堆栈正确显示
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, I18nError);
    }
  }

  /**
   * 获取用户友好的错误信息
   */
  getUserMessage(): string {
    switch (this.type) {
      case I18nErrorType.PERMISSION_ERROR:
        return `权限不足: ${this.message}`;
      case I18nErrorType.API_ERROR:
        return `API调用失败: ${this.message}`;
      case I18nErrorType.CONFIGURATION_ERROR:
        return `配置错误: ${this.message}`;
      case I18nErrorType.AUTHENTICATION_ERROR:
        return `认证失败: ${this.message}`;
      case I18nErrorType.INITIALIZATION_ERROR:
        return `初始化失败: ${this.message}`;
      default:
        return `系统错误: ${this.message}`;
    }
  }

  /**
   * 获取错误的严重程度
   */
  getSeverity(): "fatal" | "error" | "warning" {
    switch (this.type) {
      case I18nErrorType.PERMISSION_ERROR:
      case I18nErrorType.INITIALIZATION_ERROR:
        return "fatal";
      case I18nErrorType.API_ERROR:
      case I18nErrorType.AUTHENTICATION_ERROR:
      case I18nErrorType.CONFIGURATION_ERROR:
      default:
        return "error";
    }
  }
}

/**
 * 错误处理器类 - 简化版本，仅保留核心功能
 */
export class ErrorHandler {
  private static readonly ERROR_LOG_FILE = "i18n-errors.log";

  /**
   * 处理错误的主入口
   */
  static handle(error: Error, context?: string): void {
    if (error instanceof I18nError) {
      this.handleI18nError(error, context);
    } else {
      this.handleUnknownError(error, context);
    }
  }

  /**
   * 处理I18n系统错误
   */
  private static handleI18nError(error: I18nError, context?: string): void {
    const severity = error.getSeverity();
    const userMessage = error.getUserMessage();

    // 记录错误日志
    this.logError(error, context);

    // 根据严重程度处理
    switch (severity) {
      case "fatal":
        this.handleFatalError(error, userMessage);
        break;
      case "error":
        this.handleError(error, userMessage);
        break;
      case "warning":
        this.handleWarning(error, userMessage);
        break;
    }
  }

  /**
   * 处理未知错误
   */
  private static handleUnknownError(error: Error, context?: string): void {
    const i18nError = new I18nError(
      I18nErrorType.UNKNOWN_ERROR,
      error.message,
      { originalError: error, stack: error.stack },
      ["请检查系统日志获取更多信息", "如果问题持续，请联系技术支持"]
    );

    this.handleI18nError(i18nError, context);
  }

  /**
   * 处理致命错误
   */
  private static handleFatalError(error: I18nError, userMessage: string): void {
    Logger.error(`\n❌ 致命错误: ${userMessage}`);

    if (error.suggestions.length > 0) {
      Logger.error("\n💡 建议解决方案:");
      error.suggestions.forEach((suggestion, index) => {
        Logger.error(`   ${index + 1}. ${suggestion}`);
      });
    }

    Logger.error("\n系统将退出...\n");
    process.exit(1);
  }

  /**
   * 处理一般错误
   */
  private static handleError(error: I18nError, userMessage: string): void {
    Logger.error(`\n⚠️  错误: ${userMessage}`);

    if (error.suggestions.length > 0) {
      Logger.error("\n💡 建议解决方案:");
      error.suggestions.forEach((suggestion, index) => {
        Logger.error(`   ${index + 1}. ${suggestion}`);
      });
    }

    if (error.isRecoverable) {
      Logger.error("\n🔄 系统将尝试恢复...\n");
    } else {
      throw error; // 重新抛出不可恢复的错误
    }
  }

  /**
   * 处理警告
   */
  private static handleWarning(error: I18nError, userMessage: string): void {
    Logger.warn(`\n⚠️  警告: ${userMessage}`);

    if (error.suggestions.length > 0) {
      Logger.warn("\n💡 建议:");
      error.suggestions.forEach((suggestion, index) => {
        Logger.warn(`   ${index + 1}. ${suggestion}`);
      });
    }
    Logger.warn(""); // 空行
  }

  /**
   * 记录错误到日志文件 - 简化版本
   */
  private static logError(error: I18nError, context?: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type: error.type,
      message: error.message,
      context,
    };

    try {
      const fs = require("fs");
      const logLine = JSON.stringify(logEntry) + "\n";
      fs.appendFileSync(this.ERROR_LOG_FILE, logLine);
    } catch (logError: any) {
      // 静默处理日志写入失败
    }
  }

  /**
   * 创建预定义错误的便捷方法 - 仅保留实际使用的
   */
  static createConfigurationError(
    issue: string,
    details?: any
  ): I18nError {
    return new I18nError(
      I18nErrorType.CONFIGURATION_ERROR,
      `配置错误: ${issue}`,
      details,
      [
        "检查配置文件格式是否正确",
        "确认所有必需的配置项都已设置",
        "参考文档示例配置",
      ]
    );
  }

  static createNetworkError(
    operation: string,
    originalError: Error
  ): I18nError {
    return new I18nError(
      I18nErrorType.API_ERROR,
      `网络操作失败: ${operation}`,
      { operation, originalError: originalError.message },
      ["检查网络连接是否正常", "确认防火墙设置", "稍后重试操作"],
      true // 网络错误通常是可恢复的
    );
  }
}
