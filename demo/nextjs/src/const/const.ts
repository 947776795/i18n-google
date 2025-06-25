import { I18nUtil } from "@utils";
import Translations from "@translate/const/const";

// 不能这么使用 next/headers Next.js 的 headers() 等动态 API 必须在请求处理期间（即组件渲染时）调用，不能在模块加载时调用。
// const I18n = await I18nUtil.createScoped(Translations);
// export const TEST = I18n.t("sadasdad");
// export const TEST2 = I18n.t("bbb");

// console.log(TEST, "TESTTESTTESTTEST");

export const getConstants = (locale: string) => {
  const I18n = I18nUtil.createScopedSync(Translations, locale);
  return {
    TEST: I18n.t("sadasdad"),
    TEST2: I18n.t("bbb"),
  };
};
