/**
 * 翻译记录数据结构
 *
 * 三层结构：
 * - 文件夹名称（路由路径_拼接）
 *   - 语言文件（en.json, es.json）
 *     - Key-Value 翻译对
 */

/**
 * 语言翻译 Key-Value 对
 * @example { "Welcome": "Welcome", "Login": "Login" }
 */
export interface LanguageTranslations {
  [key: string]: string;
}

/**
 * 文件夹翻译集合
 * key 是语言文件名，如 "en.json", "es.json"
 * @example { "en.json": { "Welcome": "Welcome" }, "es.json": { "Welcome": "Bienvenido" } }
 */
export interface FolderTranslations {
  [languageFile: string]: LanguageTranslations;
}

/**
 * 完整翻译记录
 * key 是文件夹名称（路由路径_拼接），如 "pages_login", "components_header"
 * @example {
 *   "pages_login": {
 *     "en.json": { "Welcome": "Welcome" },
 *     "es.json": { "Welcome": "Bienvenido" }
 *   }
 * }
 */
export interface CompleteTranslationRecord {
  [folderName: string]: FolderTranslations;
}

/**
 * 翻译条目
 */
export interface TranslationEntry {
  /** 翻译 key */
  key: string;

  /** 所属文件夹名称 */
  folderName: string;

  /** 各语言翻译 */
  translations: {
    [language: string]: string;
  };
}

/**
 * 文件引用信息
 */
export interface FileReference {
  /** 文件路径 */
  filePath: string;

  /** 行号 */
  lineNumber: number;

  /** 列号 */
  columnNumber: number;

  /** 翻译 key */
  key: string;
}

/**
 * 收集结果
 */
export interface CollectResult {
  /** 所有引用的映射 */
  references: Map<string, FileReference[]>;

  /** 新翻译数量 */
  newTranslationsCount: number;
}

/**
 * 删除结果
 */
export interface DeleteResult {
  /** 删除数量 */
  deletedCount: number;

  /** 受影响的语言 */
  affectedLanguages: string[];

  /** 删除的 keys */
  deletedKeys: string[];
}
