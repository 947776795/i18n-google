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
 * I18n 工具类 - 支持模块化翻译（简化版）
 */
class I18nUtil {
  /**
   * 获取当前语言设置
   * 优先从 URL 参数读取，其次从 localStorage，最后默认为 'en'
   */
  static getCurrentLocale(): string {
    if (typeof window === "undefined") return "en"; // SSR 支持

    // 从 URL 参数获取语言设置
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get("lang");

    if (urlLang) {
      // 将语言设置保存到 localStorage
      localStorage.setItem("i18n-locale", urlLang);
      return urlLang;
    }

    // 从 localStorage 获取
    const storedLang = localStorage.getItem("i18n-locale");
    if (storedLang) {
      return storedLang;
    }

    return "en"; // 默认语言
  }

  /**
   * 创建作用域翻译实例
   * @param translations 模块翻译数据
   * @returns 翻译实例，包含 t 方法
   */
  static createScoped(translations: ModuleTranslations) {
    const locale = this.getCurrentLocale();

    return {
      /**
       * 翻译方法
       * @param key 翻译键（原文案）
       * @param options 插值选项
       * @returns 翻译后的文本
       */
      t: (key: string, options?: Record<string, any>): string => {
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
      },
    };
  }

  /**
   * 切换语言（通过页面跳转）
   * @param newLocale 新的语言代码
   */
  static switchLocale(newLocale: string): void {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    url.searchParams.set("lang", newLocale);

    // 更新 URL 并刷新页面
    window.location.href = url.toString();
  }

  /**
   * 变量插值处理
   * @param template 模板字符串
   * @param variables 变量对象
   * @returns 插值后的字符串
   */
  static interpolateVariables(
    template: string,
    variables: Record<string, any>
  ): string {
    return template.replace(/%\{(\w+)\}/g, (match, key) => {
      const value = variables[key];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * 获取支持的语言列表
   */
  static getSupportedLocales(): string[] {
    return ["en", "zh-CN", "zh-TC", "ko", "es", "tr", "de", "vi"];
  }

  /**
   * 检查是否为有效的语言代码
   */
  static isValidLocale(locale: string): boolean {
    return this.getSupportedLocales().includes(locale);
  }
}

export { I18nUtil };
export type { ModuleTranslations };
