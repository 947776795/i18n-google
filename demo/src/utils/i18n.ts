// import { EN, ZHCN, ZHTC } from '@constants/index'

export const ZHTC = "zh-TC";
export const EN = "en";
export const ZHCN = "zh-CN";
export const KO = "ko";
export const ES = "es";
export const TR = "tr";
export const DE = "de";
export const VI = "vi";

import { en, zh, zhTC, ko, es, tr, de, vi } from "../translate";

export type Locale =
  | typeof EN
  | typeof ZHCN
  | typeof ZHTC
  | typeof KO
  | typeof ES
  | typeof TR
  | typeof DE
  | typeof VI;
export type TranslationKey = string;
export type TranslationDictionary = Record<TranslationKey, string>;

export const locales: Locale[] = [EN, ZHCN, ZHTC, KO, ES, TR, DE, VI];

export const languageOptions = [
  // 繁体中文（台湾/香港）
  { label: "中文（繁體）", value: ZHTC, key: "zh-TC" },
  // 英语（国际）
  { label: "English", value: EN, key: "en" },
  // 简体中文（中国大陆）
  { label: "中文（简体）", value: ZHCN, key: "zh" },
  // 韩语
  { label: "한국어", value: KO, key: "ko" },
  // 西班牙语
  { label: "Español", value: ES, key: "es" },
  // 土耳其语
  { label: "Türkçe", value: TR, key: "tr" },
  // 德语
  { label: "Deutsch", value: DE, key: "de" },
  // 越南语
  { label: "Tiếng Việt", value: VI, key: "vi" },
];

interface TranslationStore {
  en: TranslationDictionary;
  zh: TranslationDictionary;
  "zh-TC": TranslationDictionary;
  ko: TranslationDictionary;
  es: TranslationDictionary;
  tr: TranslationDictionary;
  de: TranslationDictionary;
  vi: TranslationDictionary;
}

const I18nTranslations: TranslationStore = {
  en,
  zh,
  "zh-TC": zhTC,
  ko,
  es,
  tr,
  de,
  vi,
};

interface MessageOptions {
  [key: string]: string | number;
}

const handleMsg = (msg: string, options?: MessageOptions): string => {
  if (!msg) {
    return msg;
  }
  if (!options) {
    return msg;
  }
  const reg = /(%\{([^}]+)\})/g;
  const groups = Array.from(msg.matchAll(reg));
  if (!groups.length) {
    return msg;
  }
  let newMessage = msg;
  groups.forEach((match) => {
    const [group, , key] = match;
    if (key && typeof key === "string") {
      newMessage = newMessage.replace(group, String(options[key.trim()] || ""));
    }
  });
  return newMessage;
};

interface I18nUtilType {
  t: (msg: TranslationKey, options?: MessageOptions) => string;
  locale: Locale;
  updateLocale: (newLocale: Locale) => void;
}

const I18nUtil: I18nUtilType = {
  t: function (msg: TranslationKey, options?: MessageOptions): string {
    switch (I18nUtil.locale) {
      case ZHCN:
        return handleMsg(I18nTranslations.zh?.[msg] ?? msg, options);
      case ZHTC:
        return handleMsg(I18nTranslations["zh-TC"]?.[msg] ?? msg, options);
      case KO:
        return handleMsg(I18nTranslations.ko?.[msg] ?? msg, options);
      case ES:
        return handleMsg(I18nTranslations.es?.[msg] ?? msg, options);
      case TR:
        return handleMsg(I18nTranslations.tr?.[msg] ?? msg, options);
      case DE:
        return handleMsg(I18nTranslations.de?.[msg] ?? msg, options);
      case VI:
        return handleMsg(I18nTranslations.vi?.[msg] ?? msg, options);
      case EN:
      default:
        return handleMsg(I18nTranslations.en?.[msg] ?? msg, options);
    }
  },
  locale: EN,
  updateLocale: (newLocale: Locale): void => {
    I18nUtil.locale = newLocale;
  },
};

export { I18nUtil as I18n };
export default I18nUtil;
