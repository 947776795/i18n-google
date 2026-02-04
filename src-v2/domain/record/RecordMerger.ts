/**
 * Domain - Record Module
 * 记录合并器 - 合并远端、本地和新扫描的翻译数据
 */

import { TranslationRecord } from '../../types/record';
import { MergeResult } from '../../types/sync';

/**
 * 记录合并器
 *
 * 职责：合并三方数据（远端、本地、新扫描）
 *
 * 🔑 设计变更：内存中统一使用语言代码（如 "en"），不再使用 "en.json"
 *
 * 合并策略：
 * - 老 keys（已存在于本地或远端）：
 *   - 远端有翻译 → 采用远端
 *   - 远端无，本地有 → 采用本地
 *   - 都无 → 使用原文
 * - 新 keys（本次扫描发现）：
 *   - 直接添加，值 = 原文（待翻译）
 */
export class RecordMerger {
  /**
   * 合并三方数据
   *
   * @param remote 远端翻译记录（内存格式，locale 为 "en" 等）
   * @param local 本地翻译记录（内存格式，locale 为 "en" 等）
   * @param newKeys 新扫描的 keys
   * @param folderName 当前文件夹名称
   * @param configLocales 配置文件中定义的所有语言（可选）
   * @returns 合并结果（内存格式，locale 为 "en" 等）
   */
  merge(
    remote: TranslationRecord,
    local: TranslationRecord,
    newKeys: Set<string>,
    folderName: string,
    configLocales?: string[]
  ): MergeResult {
    const mergedRecord: TranslationRecord = {};
    const stats = {
      fromRemote: 0,
      fromLocal: 0,
      newKeys: 0,
    };

    // 初始化当前文件夹
    mergedRecord[folderName] = {};

    // 收集所有可能的 keys
    const allKeys = new Set<string>();

    // 从远端收集 keys
    if (remote[folderName]) {
      for (const locale of Object.keys(remote[folderName])) {
        Object.keys(remote[folderName][locale]).forEach(key => allKeys.add(key));
      }
    }

    // 从本地收集 keys
    if (local[folderName]) {
      for (const locale of Object.keys(local[folderName])) {
        Object.keys(local[folderName][locale]).forEach(key => allKeys.add(key));
      }
    }

    // 添加新 keys
    newKeys.forEach(key => allKeys.add(key));

    // 获取所有涉及的语言（优先使用配置的语言列表）
    const locales = this.collectAllLocales(remote, local, folderName, configLocales);

    // 为每种语言合并数据
    for (const locale of locales) {
      // 🔑 确保使用语言代码（移除可能的 .json 后缀）
      const localeCode = locale.endsWith('.json') ? locale.slice(0, -5) : locale;
      mergedRecord[folderName][localeCode] = {};

      for (const key of allKeys) {
        const mergedValue = this.mergeKey(key, localeCode, remote, local, folderName);

        // 统计来源
        if (mergedValue.source === 'remote') {
          stats.fromRemote++;
        } else if (mergedValue.source === 'local') {
          stats.fromLocal++;
        } else if (mergedValue.source === 'new') {
          stats.newKeys++;
        }

        mergedRecord[folderName][localeCode][key] = mergedValue.value;
      }
    }

    return { mergedRecord, stats };
  }

  /**
   * 合并单个 key 的翻译
   *
   * @param key 翻译键
   * @param localeCode 语言代码（如 "en"）
   * @param remote 远端记录（内存格式）
   * @param local 本地记录（内存格式）
   * @param folderName 文件夹名称
   * @returns 合并结果 { value: string, source: 'remote' | 'local' | 'new' }
   */
  private mergeKey(
    key: string,
    localeCode: string,
    remote: TranslationRecord,
    local: TranslationRecord,
    folderName: string
  ): { value: string; source: 'remote' | 'local' | 'new' } {
    // 优先：远端有翻译
    if (remote[folderName]?.[localeCode]?.[key]) {
      return {
        value: remote[folderName][localeCode][key],
        source: 'remote',
      };
    }

    // 次之：本地有翻译
    if (local[folderName]?.[localeCode]?.[key]) {
      return {
        value: local[folderName][localeCode][key],
        source: 'local',
      };
    }

    // 默认：使用 key 作为原文（新 key）
    return {
      value: key,
      source: 'new',
    };
  }

  /**
   * 收集所有涉及的语言
   *
   * @param remote 远端记录
   * @param local 本地记录
   * @param folderName 文件夹名称
   * @param configLocales 配置文件中定义的所有语言（可选）
   * @returns 语言代码列表（如 ["en", "ko"]）
   */
  private collectAllLocales(
    remote: TranslationRecord,
    local: TranslationRecord,
    folderName: string,
    configLocales?: string[]
  ): string[] {
    // 优先使用配置的语言列表
    if (configLocales && configLocales.length > 0) {
      return configLocales.map(l => l.endsWith('.json') ? l.slice(0, -5) : l);
    }

    // 否则从远端和本地记录收集
    const locales = new Set<string>();

    if (remote[folderName]) {
      Object.keys(remote[folderName]).forEach(locale => {
        // 🔑 记录中已经是语言代码（如 "en"），移除可能的 .json 后缀
        const localeCode = locale.endsWith('.json') ? locale.slice(0, -5) : locale;
        locales.add(localeCode);
      });
    }

    if (local[folderName]) {
      Object.keys(local[folderName]).forEach(locale => {
        // 🔑 记录中已经是语言代码（如 "en"），移除可能的 .json 后缀
        const localeCode = locale.endsWith('.json') ? locale.slice(0, -5) : locale;
        locales.add(localeCode);
      });
    }

    // 如果没有语言数据，使用默认语言 'en'
    if (locales.size === 0) {
      return ['en'];
    }

    return Array.from(locales);
  }
}
