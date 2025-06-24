import {
  LOCALES,
  type Locale,
  type TranslationKey,
  type TranslationDictionary,
  type MessageOptions,
  type LanguageOption,
} from "./i18n.types";

// 导出常量以保持向后兼容
export const { ZHTC, EN, ZHCN, KO, ES, TR, DE, VI } = LOCALES;

// 重新导出类型
export type { Locale, TranslationKey, TranslationDictionary, MessageOptions };

export const locales: readonly Locale[] = Object.values(LOCALES);

export const languageOptions: readonly LanguageOption[] = [
  // 繁体中文（台湾/香港）
  { label: "中文（繁體）", value: ZHTC },
  // 英语（国际）
  { label: "English", value: EN },
  // 简体中文（中国大陆）
  { label: "中文（简体）", value: ZHCN },
  // 韩语
  { label: "한국어", value: KO },
  // 西班牙语
  { label: "Español", value: ES },
  // 土耳其语
  { label: "Türkçe", value: TR },
  // 德语
  { label: "Deutsch", value: DE },
  // 越南语
  { label: "Tiếng Việt", value: VI },
] as const;

/**
 * 模块化翻译接口定义
 */
interface ModuleTranslations {
  [locale: string]: { [key: string]: string };
}

/**
 * 插值变量类型定义
 */
type InterpolationVariables = Record<string, string | number | boolean>;

/**
 * I18n 工具类 - 真正统一的方案
 */
class I18nUtil {
  /**
   * 创建翻译实例 - 统一方法
   * @param translations 模块翻译数据
   * @param searchParams 可选的 searchParams（服务端组件必须传入）
   * @returns 翻译实例，包含 t 方法
   */
  static createScoped(
    translations: ModuleTranslations,
    searchParams?: { [key: string]: string | string[] | undefined }
  ) {
    const locale = this.getCurrentLocale(searchParams);

    return {
      t: (key: string, options?: InterpolationVariables): string => {
        return this.translate(translations, locale, key, options);
      },
    };
  }

  /**
   * 获取当前语言 - 统一方法
   * @param searchParams 可选的 searchParams
   * @returns 语言代码，默认 'en'
   */
  static getCurrentLocale(searchParams?: {
    [key: string]: string | string[] | undefined;
  }): string {
    // 1. 优先从 searchParams 获取（服务端和客户端都支持）
    if (searchParams?.lang) {
      const lang = Array.isArray(searchParams.lang)
        ? searchParams.lang[0]
        : searchParams.lang;

      if (this.isValidLocale(lang)) {
        return lang;
      }
    }

    // 2. 客户端从 window.location.search 获取
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlLang = params.get("lang");

        if (urlLang && this.isValidLocale(urlLang)) {
          return urlLang;
        }
      } catch (error) {
        console.warn("Error getting locale from URL:", error);
      }
    }

    // 3. 默认语言
    return "en";
  }

  /**
   * 统一的翻译方法
   * @param translations 翻译数据
   * @param locale 语言代码
   * @param key 翻译键
   * @param options 插值选项
   * @returns 翻译后的文本
   */
  private static translate(
    translations: ModuleTranslations,
    locale: string,
    key: string,
    options?: InterpolationVariables
  ): string {
    // 获取当前语言的翻译
    const currentTranslations = translations[locale];
    let translation = currentTranslations?.[key];

    // 如果当前语言没有翻译，回退到英文
    if (!translation && locale !== "en") {
      translation = translations["en"]?.[key];
    }

    // 如果还是没有翻译，使用原文案
    if (!translation) {
      translation = key;
    }

    // 处理变量插值
    if (options && typeof translation === "string") {
      return this.interpolateVariables(translation, options);
    }

    return translation;
  }

  /**
   * 切换语言（通过 URL 跳转）
   * @param newLocale 新的语言代码
   */
  static switchLocale(newLocale: string): void {
    if (typeof window === "undefined") return;

    if (!this.isValidLocale(newLocale)) {
      console.warn(`Invalid locale: ${newLocale}`);
      return;
    }

    try {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", newLocale);

      // 跳转到新 URL
      window.location.href = url.toString();
    } catch (error) {
      console.error("Failed to switch locale:", error);
    }
  }

  /**
   * 变量插值处理
   * @param template 模板字符串
   * @param variables 变量对象
   * @returns 插值后的字符串
   */
  static interpolateVariables(
    template: string,
    variables: InterpolationVariables
  ): string {
    return template.replace(/%\{(\w+)\}/g, (match, key) => {
      const value = variables[key];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * 获取支持的语言列表
   */
  static getSupportedLocales(): Locale[] {
    return Object.values(LOCALES);
  }

  /**
   * 检查是否为有效的语言代码
   */
  static isValidLocale(locale: string): locale is Locale {
    return this.getSupportedLocales().includes(locale as Locale);
  }
}

export { I18nUtil };
export type { ModuleTranslations, InterpolationVariables };
