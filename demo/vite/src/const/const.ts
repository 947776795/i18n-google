import { I18nUtil } from "@utils";
import constTranslations from "@translate/const/const";
const I18n = I18nUtil.createScoped(constTranslations);
export const TEST = I18n.t("test");
export const TEST2 = I18n.t("test2");

export const TEST3 = I18n.t("ddd%{var0}", {
  var0: TEST
});
