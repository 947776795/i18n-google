import { I18nUtil } from "@utils";
import Translations from "@translate/const/const";

// 创建获取常量的函数，支持传入locale参数
export const getConstants = (locale?: string) => {
  const I18n = I18nUtil.createScoped(Translations, locale);
  return {
    TEST: I18n.t("sadasdad"),
    TEST2: I18n.t("bbb"),
    locale: I18n.locale,
  };
};

// 获取单个翻译的函数
export const getTranslation = (key: string, locale?: string) => {
  const I18n = I18nUtil.createScoped(Translations, locale);
  return I18n.t(key);
};

// 为了向后兼容，保留原有的导出形式（但这些在服务端默认为英文）
const I18n = I18nUtil.createScoped(Translations);
export const TEST = I18n.t("sadasdad");
export const TEST2 = I18n.t("bbb");
