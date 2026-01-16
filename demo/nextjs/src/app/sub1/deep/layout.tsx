/**
 * Deep Layout
 * 使用通配符和相对路径导入组件演示
 */
import WidgetWildcard from "@/components/WidgetWildcard";
import ContentRelative from "../../../components/ContentRelative";

export default function DeepLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="deep-layout">
      <h3>Deep Layout Header</h3>
      <WidgetWildcard />
      <div className="deep-content">{children}</div>
      <ContentRelative />
    </div>
  );
}
