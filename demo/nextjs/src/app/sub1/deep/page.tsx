import { I18nUtil } from "@utils";
const I18n = I18nUtil.createScoped('app_sub1_deep_page');

/**
 * Deep Page
 * 使用通配符和相对路径导入组件演示
 */
import BannerWildcard from "@/components/BannerWildcard";
import SidebarRelative from "../../../components/SidebarRelative";

export default function DeepPage() {
  return (
    <div className="deep-page">
      <h1>{I18n.t("Deep Page")}</h1>
      <BannerWildcard />
      <p>{I18n.t("This is the deep nested page content")}</p>
      <SidebarRelative />
    </div>
  );
}
