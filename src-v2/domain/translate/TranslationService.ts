/**
 * Domain - Translate Module
 * 翻译服务 - 整合翻译逻辑，为新 keys 生成翻译
 */

import { I18nConfig } from '../../types/config';
import { LLMTranslator } from './LLMTranslator';
import { Logger } from '../../utils/Logger';

/**
 * 翻译服务
 *
 * 职责：
 * - 为新发现的 keys 生成多语言翻译
 * - 整合 LLM 翻译器
 * - 处理翻译失败降级
 * - 显示翻译进度
 */
export class TranslationService {
  private translator: LLMTranslator;

  constructor(private config: I18nConfig) {
    this.translator = new LLMTranslator(config);
  }

  /**
   * 为新 keys 生成所有配置语言的翻译
   *
   * @param keys 新发现的 keys
   * @param targetLocales 目标语言列表
   * @returns Map<key, Record<locale, translation>>
   */
  async translateNewKeys(
    keys: string[],
    targetLocales: string[]
  ): Promise<Map<string, Record<string, string>>> {
    const result = new Map<string, Record<string, string>>();

    if (keys.length === 0) {
      Logger.info('📭 [AI翻译] 没有需要翻译的新 keys');
      return result;
    }

    Logger.info(`🚀 [AI翻译] 开始为 ${keys.length} 个新 keys 生成翻译`);

    // 过滤出非英文语言（英文使用原文）
    const nonEnglishLocales = this.filterNonEnglishLocales(targetLocales);

    if (nonEnglishLocales.length === 0) {
      // 只有英文，直接返回原文
      Logger.info('📋 [AI翻译] 仅包含英文语言，使用原文');
      for (const key of keys) {
        result.set(key, { en: key });
      }
      return result;
    }

    try {
      // 调用 LLM 翻译器进行批量翻译
      const translations = await this.translator.translateBatch(
        keys,
        'en',
        nonEnglishLocales
      );

      // 构建包含英文和翻译的结果
      return this.buildResultWithFallback(keys, targetLocales, translations);

    } catch (error) {
      Logger.error(`❌ [AI翻译] 翻译失败: ${error}`);
      // 降级：所有语言都使用原文
      return this.buildFallbackResult(keys, targetLocales);
    }
  }

  /**
   * 过滤非英文语言
   *
   * @param locales 语言列表
   * @returns 过滤后的语言列表（不包含 en 和 en.json）
   */
  private filterNonEnglishLocales(locales: string[]): string[] {
    return locales.filter(
      (locale) => locale !== 'en' && locale !== 'en.json'
    );
  }

  /**
   * 构建带降级的结果
   *
   * @param keys 所有 keys
   * @param locales 所有目标语言
   * @param translations LLM 翻译结果
   * @returns 完整结果 Map
   */
  private buildResultWithFallback(
    keys: string[],
    locales: string[],
    translations: Map<string, Record<string, string>>
  ): Map<string, Record<string, string>> {
    const result = new Map<string, Record<string, string>>();

    for (const key of keys) {
      const keyTranslations: Record<string, string> = {};
      const llmTranslations = translations.get(key) || {};

      for (const locale of locales) {
        // 清理 locale（移除可能的 .json 后缀）
        const localeCode = locale.endsWith('.json') ? locale.slice(0, -5) : locale;

        if (localeCode === 'en') {
          // 英文使用原文
          keyTranslations[localeCode] = key;
        } else if (llmTranslations[localeCode]) {
          // 使用 LLM 翻译
          keyTranslations[localeCode] = llmTranslations[localeCode];
        } else {
          // 降级到原文
          keyTranslations[localeCode] = key;
        }
      }

      result.set(key, keyTranslations);
    }

    return result;
  }

  /**
   * 构建降级结果（所有语言使用原文）
   *
   * @param keys 所有 keys
   * @param locales 所有目标语言
   * @returns 降级结果 Map
   */
  private buildFallbackResult(
    keys: string[],
    locales: string[]
  ): Map<string, Record<string, string>> {
    const result = new Map<string, Record<string, string>>();

    for (const key of keys) {
      const keyTranslations: Record<string, string> = {};

      for (const locale of locales) {
        const localeCode = locale.endsWith('.json') ? locale.slice(0, -5) : locale;
        keyTranslations[localeCode] = key;
      }

      result.set(key, keyTranslations);
    }

    return result;
  }
}
