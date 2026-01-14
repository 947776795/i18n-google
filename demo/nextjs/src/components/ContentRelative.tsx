import { I18nUtil as I18n } from "@utils";

/**
 * ContentRelative Component
 * 适用于相对路径导入方式
 */
export default function ContentRelative() {
  return (
    <div className="content-relative">
      <h2>{I18n.t("Deep Content")}</h2>
      <p>{I18n.t("This is deep level content")}</p>
    </div>
  );
}
