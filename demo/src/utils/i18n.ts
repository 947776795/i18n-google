import {
  LOCALES,
  type Locale,
  type TranslationKey,
  type TranslationDictionary,
  type MessageOptions,
  type LanguageOption,
  type TranslationStore,
  type I18nUtilType,
} from "./i18n.types";

import { en, zh, zhTC, ko, es, tr, de, vi } from "../translate";

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

// 直接使用 Locale 值作为键的翻译存储
const I18nTranslations: TranslationStore = {
  [EN]: en,
  [ZHCN]: zh,
  [ZHTC]: zhTC,
  [KO]: ko,
  [ES]: es,
  [TR]: tr,
  [DE]: de,
  [VI]: vi,
};

// 缓存正则表达式以提高性能
const INTERPOLATION_REGEX = /(%\{([^}]+)\})/g;

const handleMsg = (msg: string, options?: MessageOptions): string => {
  if (!msg || !options) {
    return msg;
  }

  // 重置正则表达式的 lastIndex
  INTERPOLATION_REGEX.lastIndex = 0;

  return msg.replace(INTERPOLATION_REGEX, (match, _, key) => {
    if (key && typeof key === "string") {
      const value = options[key.trim()];
      return value !== undefined ? String(value) : match;
    }
    return match;
  });
};

const I18nUtil: I18nUtilType = {
  t: function (msg: TranslationKey, options?: MessageOptions): string {
    try {
      const translation = I18nTranslations[I18nUtil.locale]?.[msg];

      // 如果当前语言没有翻译，回退到英文
      const finalMessage = translation ?? I18nTranslations[EN]?.[msg] ?? msg;

      return handleMsg(finalMessage, options);
    } catch (error) {
      console.warn(`Translation error for key "${msg}":`, error);
      return msg;
    }
  },

  locale: EN,

  updateLocale: (newLocale: Locale): void => {
    if (I18nUtil.isValidLocale(newLocale)) {
      I18nUtil.locale = newLocale;
    } else {
      console.warn(`Invalid locale: ${newLocale}. Falling back to ${EN}`);
      I18nUtil.locale = EN;
    }
  },

  isValidLocale: (locale: string): locale is Locale => {
    return locales.includes(locale as Locale);
  },
};

export { I18nUtil as I18n };
export default I18nUtil;
