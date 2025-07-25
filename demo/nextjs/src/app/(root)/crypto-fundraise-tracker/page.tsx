import Translations from "@translate/app/(root)/crypto-fundraise-tracker/page";
import { I18nUtil } from "@utils/i18n";
const I18n = I18nUtil.createScoped(Translations);
export default function CryptoGptPage() {
  return <div>{I18n.t("page test")}</div>;
}
