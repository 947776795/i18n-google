import { I18nUtil as I18n } from "@utils";

/**
 * FooterRelative Component
 * 适用于相对路径导入方式
 */
export default function FooterRelative() {
  return (
    <footer className="footer-relative">
      <p>{I18n.t("Copyright 2024")}</p>
      <p>{I18n.t("All rights reserved")}</p>
    </footer>
  );
}
