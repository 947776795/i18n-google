import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // i18n: {
  //   // 支持的语言列表 - 使用 Unicode LDML 标准
  locales: ["en", "zh-Hans", "zh-Hant", "ko"],
  //   // 默认语言
  defaultLocale: "en",
  //   // 禁用自动语言检测，使用 URL 参数控制
  //   localeDetection: false,
  // },
};

export default nextConfig;
