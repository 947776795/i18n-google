/**
 * 10 层嵌套的深层页面
 * 用于测试路径映射是否正确
 */
export default function DeepNestedPage() {
  return (
    <div className="deep-nested-page">
      <h1>Deep Nested Page</h1>
      <p>This is a page at 10 levels deep</p>
      <span>Testing path mapping</span>
    </div>
  );
}
