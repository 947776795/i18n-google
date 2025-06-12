// 核心扫描器 - 主要入口点
export { I18nScanner } from "./I18nScanner";

// 文件处理
export { FileScanner } from "./FileScanner";
export { FileTransformer } from "./FileTransformer";

// AST 转换 - 核心逻辑
export { AstTransformer, TransformResult } from "./AstTransformer";

// 翻译管理
export { TranslationManager } from "./TranslationManager";

// Google Sheets 集成
export { GoogleSheetsSync } from "./GoogleSheetsSync";

// 工具类
export { StringUtils } from "./utils/StringUtils";
export { AstUtils } from "./utils/AstUtils";

// 重新导出类型
export type { I18nConfig } from "../types";
