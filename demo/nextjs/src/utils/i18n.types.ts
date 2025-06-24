export const LOCALES = {
  EN: "en", // 英语（默认语言）
  ZHCN: "zh-Hans", // 中文简体（使用简体汉字）
  ZHTW: "zh-Hant", // 中文繁体（使用繁体汉字）
  KO: "ko", // 韩语
} as const;

export type Locale = (typeof LOCALES)[keyof typeof LOCALES];

export type TranslationKey = string;

export type TranslationDictionary = Record<TranslationKey, string>;

export interface MessageOptions {
  [key: string]: string | number;
}

export interface LanguageOption {
  readonly label: string;
  readonly value: Locale;
}

export type TranslationStore = Record<Locale, TranslationDictionary>;

export interface I18nUtilType {
  t: (msg: TranslationKey, options?: MessageOptions) => string;
  locale: Locale;
  updateLocale: (newLocale: Locale) => void;
  isValidLocale: (locale: string) => locale is Locale;
}
