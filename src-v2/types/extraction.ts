/**
 * 提取相关的类型定义
 * 统一AST级标记内容提取的数据结构和接口
 */

/**
 * 提取内容类型
 */
export type ExtractionType = 'string' | 'template' | 'jsx-mixed';

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
 * 变量映射信息
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
 * 元素工厂信息
 */
export interface ElementFactory {
  /** 占位符名称 (el0, el1...) */
  placeholder: string;
  
  /** 元素类型名称 */
  elementType: string;
  
  /** 是否包含文本内容 */
  hasTextContent: boolean;
  
  /** 元素位置 */
  position: Position;
  
  /** 属性列表 */
  attributes: Record<string, any>;
  
  /** 是否为嵌套元素 */
  isNested?: boolean;
  
  /** 父元素占位符 */
  parentPlaceholder?: string;
}

/**
 * 文本片段信息
 */
export interface TextFragment {
  /** 文本内容 */
  content: string;
  
  /** 位置 */
  position: Position;
  
  /** 是否为空文本 */
  isEmpty: boolean;
}

/**
 * 混合内容解析结果
 */
export interface MixedContentParseResult {
  /** 元素列表 */
  elements: ElementFactory[];
  
  /** 文本片段列表 */
  textFragments: TextFragment[];
  
  /** 平铺后的占位符内容 */
  flattenedContent: string;
  
  /** 是否包含嵌套结构 */
  hasNestedElements: boolean;
}

/**
 * 提取内容的统一结构
 */
export interface ExtractedContent {
  /** 提取类型 */
  type: ExtractionType;
  
  /** 原始标记内容 */
  originalText: string;
  
  /** 清理后的文本内容 */
  cleanedText: string;
  
  /** 在源码中的位置 */
  position: Position;
  
  /** 提取上下文 */
  context: ExtractionContext;
  
  /** 变量映射 (模板和JSX混合) */
  variables?: VariableMapping[];
  
  /** 元素工厂 (仅JSX混合) */
  elements?: ElementFactory[];
  
  /** 是否包含英文字符 */
  hasEnglish: boolean;
  
  /** 翻译键 */
  translationKey?: string;
}

/**
 * 提取选项配置
 */
export interface ExtractionOptions {
  /** 是否启用AST提取 */
  enableASTExtraction: boolean;
  
  /** 是否处理模板字符串 */
  processTemplates: boolean;
  
  /** 是否处理JSX混合内容 */
  processJSXMixed: boolean;
  
  /** 是否要求包含英文字符 */
  requireEnglish: boolean;
  
  /** 错误处理策略 */
  errorHandling: 'strict' | 'lenient' | 'fallback';
}

/**
 * Type guard for string content
 */
export function isStringMarkedContent(content: any): content is ExtractedMarkedContent & { type: 'string' } {
  return content && content.type === 'string';
}

/**
 * Type guard for template string content
 */
export function isTemplateString(content: any): content is ExtractedMarkedContent & { type: 'template' } {
  return content && content.type === 'template';
}

/**
 * Type guard for JSX mixed content
 */
export function isJSXMarkedContent(content: any): content is ExtractedMarkedContent & { type: 'jsx-mixed' } {
  return content && content.type === 'jsx-mixed';
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
 * Marked match information
 */
export interface MarkedMatch {
  /** Full matched text including markers */
  fullMatch: string;
  
  /** Content without markers */
  content: string;
  
  /** Start position in source */
  start: number;
  
  /** End position in source */
  end: number;
  
  /** Nesting level */
  nestingLevel: number;
}

/**
 * Extracted marked content (extended from ExtractedContent)
 */
export interface ExtractedMarkedContent extends ExtractedContent {
  /** Source range in original file */
  sourceRange: SourceRange;
  
  /** Key for translation */
  key: string;
  
  /** Whether to skip this content */
  skip?: boolean;
  
  /** Variables extracted from template strings */
  extractedVariables?: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'jsx-element';
    placeholder: string;
    expression?: string;
  }>;
  
  /** JSX elements found in mixed content */
  jsxElements?: Array<{
    tagName: string;
    content: string;
    hasAttributes: boolean;
    hasChildren: boolean;
  }>;
}

/**
 * Complete extraction result
 */
export interface ExtractionResult {
  /** All extracted marked content */
  extractedContents: ExtractedMarkedContent[];
  
  /** All raw matches found */
  allMatches: MarkedMatch[];
  
  /** File path */
  filePath: string;
  
  /** Total processing time */
  processingTime: number;
}