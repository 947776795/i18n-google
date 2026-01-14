import { I18nUtil as I18n } from "@utils";

/**
 * HeaderWildcard Component
 * 适用于通配符导入方式
 */
export default function HeaderWildcard() {
  return (
    <header className="header-wildcard">
      <h1>{I18n.t("Header Title")}</h1>
      <p>{I18n.t("Welcome to our application")}</p>
    </header>
  );
}
