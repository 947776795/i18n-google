export const LOCALES = {
  EN: "en", // 英语（默认语言）
  ZHCN: "zh-Hans", // 中文简体（使用简体汉字）
  ZHTW: "zh-Hant", // 中文繁体（使用繁体汉字）
  KO: "ko", // 韩语
} as const;

export type Locale = (typeof LOCALES)[keyof typeof LOCALES];

export interface LanguageOption {
  readonly label: string;
  readonly value: Locale;
}
