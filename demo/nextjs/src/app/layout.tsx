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
        <main>Main Content Area</main>
        {children}
        <FooterRelative />
      </body>
    </html>
  );
}
