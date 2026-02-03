/**
 * Sub1 Page
 * 使用通配符和相对路径导入组件演示
 */
import FooterWildcard from "@/components/FooterWildcard";
import HeaderRelative from "../../components/HeaderRelative";

export default function Sub1Page() {
  return (
    <div className="sub1-page">
      <h1>Sub1 Page</h1>
      <HeaderRelative />
      <p>This is the sub1 page content</p>
      <FooterWildcard />
    </div>
  );
}
