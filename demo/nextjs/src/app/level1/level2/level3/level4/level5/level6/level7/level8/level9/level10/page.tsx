import { I18nUtil } from "@utils";
const I18n = I18nUtil.createScoped('app_level1_level2_level3_level4_level5_level6_level7_level8_level9_level10_page');

/**
 * 10 层嵌套的深层页面
 * 用于测试路径映射是否正确
 */
export default function DeepNestedPage() {
  return (
    <div className="deep-nested-page">
      <h1>{I18n.t("Deep Nested Page")}</h1>
      <p>{I18n.t("This is a page at 10 levels deep")}</p>
      <span>{I18n.t("Testing path mapping")}</span>
    </div>
  );
}
