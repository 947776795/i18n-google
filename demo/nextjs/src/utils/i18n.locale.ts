export const LOCALES = {
  EN: "en", // 英语（默认语言）
  ZHCN: "zh-Hans", // 中文简体（使用简体汉字）
  ZHTW: "zh-Hant", // 中文繁体（使用繁体汉字）
  KO: "ko", // 韩语
  VI: "vi", // 越南语
  ES: "es", // 西班牙语
  TR: "tr", // 土耳其语
  DE: "de", // 德语
} as const;

export type Locale = (typeof LOCALES)[keyof typeof LOCALES];
