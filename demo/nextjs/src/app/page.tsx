import { I18nUtil } from "@utils";
const I18n = I18nUtil.createScoped('app_page');

/**
 * Root Page
 * 使用通配符和相对路径导入组件演示
 */
import ContentWildcard from "@/components/ContentWildcard";
import SidebarRelative from "../components/SidebarRelative";

export default function HomePage() {
  return (
    <div className="home-page">
      <h1>{I18n.t("Home Page")}</h1>
      <ContentWildcard />
      <SidebarRelative />
    </div>
  );
}
