import { I18nUtil } from "@utils";
import Translations from "@translate/const/const";
const I18n = I18nUtil.createScoped(Translations);
export const TEST = I18n.t("1111");
export const TEST2 = I18n.t("2222%{var0}", {
  var0: TEST
});
