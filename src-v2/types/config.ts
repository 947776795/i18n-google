/**
 * 配置类型定义
 */

/**
 * 日志级别
 */
export type LogLevel = "silent" | "normal" | "verbose";

/**
 * I18n 配置接口
 */
export interface I18nConfig {
  /** 根目录 */
  rootDir: string;

  /** 支持的语言列表 */
  languages: string[];

  /** 忽略的文件/目录模式 */
  ignore: string[];

  /** Google Sheets ID */
  spreadsheetId: string;

  /** Sheet 名称 */
  sheetName: string;

  /** 服务账号密钥文件路径 */
  keyFile: string;

  /** 开始标记符号 */
  startMarker: string;

  /** 结束标记符号 */
  endMarker: string;

  /** 包含的文件扩展名 */
  include: string[];

  /** 输出目录 */
  outputDir: string;

  /** 日志级别 */
  logLevel?: LogLevel;

  /** Sheets 读取范围 */
  sheetsReadRange?: string;

  /** API Key */
  apiKey: string;

  /** Sheets 最大行数 */
  sheetsMaxRows?: number;

  /** 测试模式 */
  testMode?: boolean;

  /** LLM 翻译重试次数 */
  llmRetries?: number;

  /** LLM 翻译超时时间（毫秒） */
  llmTimeout?: number;

  /** LLM 温度参数 */
  llmTemperature?: number;

  /** LLM 模型名称 */
  llmModel?: string;

  /** 每批处理的 key 数量（默认 15） */
  llmBatchSize?: number;

  /** 批次间延迟毫秒数（默认 500） */
  llmBatchDelay?: number;
}

/**
 * 翻译选项
 */
export interface TranslationOptions {
  /** 重试次数 */
  retries?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 温度参数 */
  temperature?: number;
  /** 模型名称 */
  model?: string;
  /** 每批处理的 key 数量 */
  batchSize?: number;
  /** 批次间延迟（毫秒） */
  batchDelay?: number;
}
