import { I18nUtil as I18n } from "@utils";

/**
 * SidebarRelative Component
 * 适用于相对路径导入方式
 */
export default function SidebarRelative() {
  return (
    <aside className="sidebar-relative">
      <h3>{I18n.t("Sidebar")}</h3>
      <ul>
        <li>{I18n.t("Home")}</li>
        <li>{I18n.t("About")}</li>
        <li>{I18n.t("Contact")}</li>
      </ul>
    </aside>
  );
}
