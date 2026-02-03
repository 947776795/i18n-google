/**
 * Root Page
 * 使用通配符和相对路径导入组件演示
 */
import ContentWildcard from "@/components/ContentWildcard";
import SidebarRelative from "../components/SidebarRelative";

export default function HomePage() {
  return (
    <div className="home-page">
      <h1>Home Page</h1>
      <ContentWildcard />
      <SidebarRelative />
    </div>
  );
}
