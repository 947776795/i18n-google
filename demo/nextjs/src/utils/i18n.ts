import {
  LOCALES,
  type Locale,
  type TranslationKey,
  type TranslationDictionary,
  type MessageOptions,
  type LanguageOption,
} from "./i18n.types";

// 导出常量以保持向后兼容
export const { EN, ZHCN, ZHTW, KO } = LOCALES;

// 重新导出类型
export type { Locale, TranslationKey, TranslationDictionary, MessageOptions };

export const locales: readonly Locale[] = Object.values(LOCALES);

export const languageOptions: readonly LanguageOption[] = [
  // 英语（默认）
  { label: "English", value: EN },
  // 简体中文（使用简体汉字）
  { label: "中文（简体）", value: ZHCN },
  // 繁体中文（使用繁体汉字）
  { label: "中文（繁體）", value: ZHTW },
  // 韩语
  { label: "한국어", value: KO },
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
 * I18n 工具类 - 从 URL 路径获取语言（适配 Next.js）
 */
class I18nUtil {
  /**
   * 创建翻译实例 - 适配 Next.js 路由
   * @param translations 模块翻译数据
   * @param locale 可选的直接传入语言代码（用于服务端组件）
   * @returns 翻译实例，包含 t 方法
   */
  static createScoped(translations: ModuleTranslations, locale?: string) {
    const currentLocale = locale || this.getCurrentLocale();

    return {
      t: (key: string, options?: InterpolationVariables): string => {
        return this.translate(translations, currentLocale, key, options);
      },
      locale: currentLocale,
    };
  }

  /**
   * 获取当前语言 - 从 URL 路径获取（Next.js 方式）
   * @returns 语言代码，默认 'en'
   */
  static getCurrentLocale(): string {
    // 服务端渲染时返回默认语言
    if (typeof window === "undefined") {
      return "en";
    }

    try {
      // 从 URL 路径中获取语言代码
      // Next.js i18n 路由格式：
      // /zh-Hans/about -> zh-Hans
      // /ko/contact -> ko
      // /about -> en (默认语言，路径中不显示)
      const pathname = window.location.pathname;
      const segments = pathname.split("/").filter(Boolean);

      if (segments.length > 0) {
        const potentialLocale = segments[0];

        // 检查第一个路径段是否为有效语言代码
        if (this.isValidLocale(potentialLocale)) {
          return potentialLocale;
        }
      }

      // 如果路径中没有语言代码，说明是默认语言
      return "en";
    } catch (error) {
      console.warn("Error getting locale from URL path:", error);
      return "en";
    }
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
   * 切换语言（通过 Next.js 路由跳转）
   * @param newLocale 新的语言代码
   */
  static switchLocale(newLocale: string): void {
    if (typeof window === "undefined") return;

    if (!this.isValidLocale(newLocale)) {
      console.warn(`Invalid locale: ${newLocale}`);
      return;
    }

    try {
      const currentPath = window.location.pathname;
      const segments = currentPath.split("/").filter(Boolean);

      // 移除当前语言代码（如果存在）
      if (segments.length > 0 && this.isValidLocale(segments[0])) {
        segments.shift(); // 移除第一个语言段
      }

      // // 构建新的路径
      let newPath: string;
      // if (newLocale === "en") {
      //   // 英语为默认语言，不需要在路径中显示
      //   newPath = "/" + segments.join("/");
      // } else {
      //   // 其他语言需要在路径前加上语言代码
      // }
      newPath = "/" + newLocale + "/" + segments.join("/");

      // 确保路径以 / 结尾（如果原路径有的话）
      if (newPath === "") newPath = "/";

      // 保持查询参数和锚点
      const search = window.location.search;
      const hash = window.location.hash;

      // 跳转到新 URL
      window.location.href = newPath + search + hash;
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

  /**
   * 获取语言选项列表（用于语言切换器）
   */
  static getLanguageOptions(): readonly LanguageOption[] {
    return languageOptions;
  }
}

export { I18nUtil };
export type { ModuleTranslations, InterpolationVariables };
