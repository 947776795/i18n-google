import { I18nUtil } from "@utils/i18n";
import Translations from "@translate/src/app/(root)/crypto-fundraise-tracker/page";
const I18n = I18nUtil.createScoped(Translations);
export default function CryptoGptPage() {
  return <div>{I18n.t("page test")}</div>;
}
