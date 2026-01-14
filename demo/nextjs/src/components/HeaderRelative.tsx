import { I18nUtil as I18n } from "@utils";

/**
 * HeaderRelative Component
 * 适用于相对路径导入方式
 */
export default function HeaderRelative() {
  return (
    <header className="header-relative">
      <h1>{I18n.t("Header Title Relative")}</h1>
      <p>{I18n.t("Welcome to our application")}</p>
    </header>
  );
}
