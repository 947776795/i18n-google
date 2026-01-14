import { I18nUtil as I18n } from "@utils";

/**
 * ContentWildcard Component
 * 适用于通配符导入方式
 */
export default function ContentWildcard() {
  return (
    <div className="content-wildcard">
      <h2>{I18n.t("Content Section")}</h2>
      <p>{I18n.t("This is the main content area")}</p>
    </div>
  );
}
