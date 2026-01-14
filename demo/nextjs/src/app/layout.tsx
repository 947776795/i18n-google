import { I18nUtil } from "@utils";
const I18n = I18nUtil.createScoped('app_layout');

/**
 * Root Layout
 * 使用通配符和相对路径导入组件演示
 */
import HeaderWildcard from "@/components/HeaderWildcard";
import FooterRelative from "../components/FooterRelative";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <HeaderWildcard />
        <main>{I18n.t("Main Content Area")}</main>
        {children}
        <FooterRelative />
      </body>
    </html>
  );
}
