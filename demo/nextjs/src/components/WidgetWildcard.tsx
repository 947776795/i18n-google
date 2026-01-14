import { I18nUtil as I18n } from "@utils";

/**
 * WidgetWildcard Component
 * 适用于通配符导入方式
 */
export default function WidgetWildcard() {
  return (
    <div className="widget-wildcard">
      <h3>{I18n.t("Widget")}</h3>
      <p>{I18n.t("This is a widget component")}</p>
      <button>{I18n.t("Click Me")}</button>
    </div>
  );
}
