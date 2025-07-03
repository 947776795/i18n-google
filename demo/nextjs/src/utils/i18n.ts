import Cookies from "js-cookie";
import { LOCALES, type Locale } from "@utils/i18n.locale";

export interface LanguageOption {
  readonly label: string;
  readonly value: Locale;
}

// 导出常量以保持向后兼容
export const { EN, ZHCN, ZHTW, KO, VI, ES, TR, DE } = LOCALES;

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
  // 越南语
  { label: "Tiếng Việt", value: VI },
  // 西班牙语
  { label: "Español", value: ES },
  // 土耳其语
  { label: "Türkçe", value: TR },
  // 德语
  { label: "Deutsch", value: DE },
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
type InterpolationVariables = Record<string, any>;

/**
 * I18n 工具类 - 从 URL 路径获取语言（适配 Next.js）
 */
class I18nUtil {
  /**
   * 创建翻译实例
   * @param translations 模块翻译数据
   * @param locale 可选的直接传入语言代码（优先级高于自动检测）
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
   * 获取当前语言 - 客户端专用
   * @returns 语言代码，默认 'en'
   */
  static getCurrentLocale(): string {
    // 仅在客户端环境下工作
    if (typeof window === "undefined") {
      return "en";
    }

    // 1. 优先从 Cookie 获取
    const cookieLocale = this.getLocaleFromCookie();
    if (cookieLocale) {
      return cookieLocale;
    }

    // 2. 从 URL 路径获取
    const urlLocale = this.getClientLocale();
    if (this.isValidLocale(urlLocale)) {
      return urlLocale;
    }

    // 3. 默认返回英语
    return "en";
  }

  /**
   * 客户端获取语言代码
   * @returns 语言代码
   */
  private static getClientLocale(): string {
    try {
      if (typeof window === "undefined") {
        return "en";
      }
      // 从 URL 路径中获取语言代码
      // Next.js i18n 路由格式：
      // /zh-Hans/about -> zh-Hans
      // /ko/contact -> ko
      // /about -> en (默认语言，路径中不显示)
      const pathname = window?.location?.pathname;
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
    } catch {
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
   * 切换语言（设置 Cookie 并通过路由跳转）
   * @param newLocale 新的语言代码
   */
  static switchLocale(newLocale: string): void {
    if (typeof window === "undefined") {
      return;
    }

    if (!this.isValidLocale(newLocale)) {
      return;
    }

    try {
      // 1. 首先设置 Cookie，供 middleware 使用
      Cookies.set("locale", newLocale, {
        expires: 365, // 1年过期
        path: "/", // 全站可用
        sameSite: "lax", // 安全设置
        secure: location.protocol === "https:", // HTTPS 时启用 secure
      });

      const currentPath = window.location.pathname;
      const segments = currentPath.split("/").filter(Boolean);

      // 移除当前语言代码（如果存在）
      if (segments.length > 0 && this.isValidLocale(segments[0])) {
        segments.shift(); // 移除第一个语言段
      }

      // 构建新的路径
      let newPath: string;
      newPath = "/" + newLocale + "/" + segments.join("/");

      // 确保路径格式正确
      if (newPath === "") {
        newPath = "/";
      }

      // 保持查询参数和锚点
      const search = window.location.search;
      const hash = window.location.hash;

      // 跳转到新 URL，middleware 会读取 Cookie 并处理重定向
      window.location.href = newPath + search + hash;
    } catch {
      console.error("Failed to switch locale");
    }
  }

  /**
   * 从 Cookie 获取语言偏好
   * @returns 语言代码或 null
   */
  static getLocaleFromCookie(): string | null {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const cookieLocale = Cookies.get("locale");
      return cookieLocale && this.isValidLocale(cookieLocale)
        ? cookieLocale
        : null;
    } catch (error) {
      console.warn("Error getting locale from cookie:", error);
      return null;
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
