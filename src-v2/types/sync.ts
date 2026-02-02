/**
 * 同步相关类型定义
 */

import { TranslationRecord } from './record';

/**
 * 远端数据结构
 * 格式: "[app/page.tsx][Welcome]" → { en: "Welcome", ko: "환영"
 */
export interface RemoteTranslationData {
  [combinedKey: string]: RemoteLocaleTranslations;
}

/**
 * 远端语言翻译映射（用于远端数据格式）
 * 与 LocaleTranslations 不同，这里的值是直接的语言代码
 */
export interface RemoteLocaleTranslations {
  [locale: string]: string;
}

/**
 * 合并结果
 */
export interface MergeResult {
  /** 合并后的记录 */
  mergedRecord: TranslationRecord;
  /** 统计信息 */
  stats: {
    /** 来自远端的 key 数量 */
    fromRemote: number;
    /** 来自本地的 key 数量 */
    fromLocal: number;
    /** 新扫描的 key 数量 */
    newKeys: number;
  };
}

/**
 * 代码引用
 */
export interface CodeReference {
  /** 文件夹名称 */
  folderName: string;
  /** 翻译键 */
  key: string;
}

/**
 * 无用 Key 分析结果
 */
export interface UnusedKeyAnalysis {
  /** 无用的 keys */
  unusedKeys: string[];
  /** 格式化后的无用 keys [folderName][key] */
  formattedUnusedKeys: string[];
  /** 总数 */
  total: number;
}
