/**
 * Deep Page
 * 使用通配符和相对路径导入组件演示
 */
import BannerWildcard from "@/components/BannerWildcard";
import SidebarRelative from "../../../components/SidebarRelative";

export default function DeepPage() {
  return (
    <div className="deep-page">
      <h1>Deep Page</h1>
      <BannerWildcard />
      <p>This is the deep nested page content</p>
      <SidebarRelative />
    </div>
  );
}
