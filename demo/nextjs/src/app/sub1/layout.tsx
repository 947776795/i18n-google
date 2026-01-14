import { I18nUtil } from "@utils";
const I18n = I18nUtil.createScoped('app_sub1_layout');

/**
 * Sub1 Layout
 * 使用通配符和相对路径导入组件演示
 */
import BannerWildcard from "@/components/BannerWildcard";
import WidgetRelative from "../../components/WidgetRelative";

export default function Sub1Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="sub1-layout">
      <h2>{I18n.t("Sub1 Layout Header")}</h2>
      <BannerWildcard />
      <div className="sub1-content">{children}</div>
      <WidgetRelative />
    </div>
  );
}
