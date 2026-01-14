import { I18nUtil as I18n } from "@utils";

/**
 * WidgetRelative Component
 * 适用于相对路径导入方式
 */
export default function WidgetRelative() {
  return (
    <div className="widget-relative">
      <h3>{I18n.t("Widget")}</h3>
      <p>{I18n.t("This is a widget component")}</p>
      <button>{I18n.t("Click Me")}</button>
    </div>
  );
}
