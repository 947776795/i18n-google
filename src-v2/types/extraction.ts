/**
 * 提取相关的类型定义（简化版）
 * 移除复杂的 JSX 混合内容提取逻辑
 */

/**
 * 提取内容类型（简化版）
 */
export type ExtractionType = 'string' | 'template' | 'jsx-text';

/**
 * 文件位置信息
 */
export interface Position {
  /** 行号 (从1开始) */
  line: number;

  /** 列号 (从0开始) */
  column: number;
}

/**
 * 提取上下文信息
 */
export interface ExtractionContext {
  /** 文件路径 */
  filePath: string;

  /** 节点类型 */
  nodeType: string;

  /** 父节点类型 */
  parentType?: string;

  /** 在JSX上下文中 */
  isInJSX: boolean;

  /** 在表达式容器中 */
  isInExpression: boolean;
}

/**
 * 变量映射信息（仅用于模板字符串）
 */
export interface VariableMapping {
  /** 占位符名称 (var0, var1...) */
  placeholder: string;

  /** 原始表达式字符串 */
  expression: string;

  /** 变量类型 */
  type: 'identifier' | 'member' | 'complex';

  /** 表达式位置 */
  position: Position;
}

/**
 * 提取内容的统一结构（简化版）
 */
export interface ExtractedContent {
  /** 提取类型 */
  type: ExtractionType;

  /** 原始标记内容 */
  originalText: string;

  /** 清理后的文本内容 */
  cleanedText: string;

  /** 翻译键 */
  translationKey: string;

  /** 在源码中的位置 */
  position: Position;

  /** 提取上下文 */
  context: ExtractionContext;

  /** 变量映射 (仅模板字符串) */
  variables?: VariableMapping[];

  /** 是否包含英文字符 */
  hasEnglish: boolean;
}

/**
 * 提取选项配置
 */
export interface ExtractionOptions {
  /** 是否启用AST提取 */
  enableASTExtraction: boolean;

  /** 是否处理模板字符串 */
  processTemplates: boolean;

  /** 是否要求包含英文字符 (JSX文本) */
  requireEnglish: boolean;

  /** 错误处理策略 */
  errorHandling: 'strict' | 'lenient' | 'fallback';
}

/**
 * Type guard for string content
 */
export function isStringContent(content: any): content is ExtractedContent & { type: 'string' } {
  return content && content.type === 'string';
}

/**
 * Type guard for template string content
 */
export function isTemplateContent(content: any): content is ExtractedContent & { type: 'template' } {
  return content && content.type === 'template';
}

/**
 * Type guard for JSX text content
 */
export function isJSXTextContent(content: any): content is ExtractedContent & { type: 'jsx-text' } {
  return content && content.type === 'jsx-text';
}

/**
 * Source range information
 */
export interface SourceRange {
  /** Start position */
  start: number;

  /** End position */
  end: number;
}

/**
 * Complete extraction result
 */
export interface ExtractionResult {
  /** All extracted content */
  extractedContents: ExtractedContent[];

  /** File path */
  filePath: string;

  /** Total processing time */
  processingTime: number;
}

/**
 * Existing I18n.t() call reference (简化版 - 只记录文件级别)
 */
export interface ExistingReference {
  /** I18n Key */
  key: string;

  /** File path */
  filePath: string;
}
