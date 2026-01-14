import { I18nUtil as I18n } from "@utils";

/**
 * FooterWildcard Component
 * 适用于通配符导入方式
 */
export default function FooterWildcard() {
  return (
    <footer className="footer-wildcard">
      <p>{I18n.t("Copyright 2024")}</p>
      <p>{I18n.t("All rights reserved")}</p>
    </footer>
  );
}
