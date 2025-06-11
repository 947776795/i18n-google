export const LOCALES = {
  ZHTC: "zh-TC",
  EN: "en",
  ZHCN: "zh-CN",
  KO: "ko",
  ES: "es",
  TR: "tr",
  DE: "de",
  VI: "vi",
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
