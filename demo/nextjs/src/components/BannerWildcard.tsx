import { I18nUtil as I18n } from "@utils";

/**
 * BannerWildcard Component
 * 适用于通配符导入方式
 */
export default function BannerWildcard() {
  return (
    <div className="banner-wildcard">
      <h2>{I18n.t("Special Offer")}</h2>
      <p>{I18n.t("Get 50% off today")}</p>
    </div>
  );
}
