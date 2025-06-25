import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function GET() {
  try {
    // 在 API 路由中，我们可以安全地使用 headers()
    const headersList = await headers();

    // 获取自定义的路径和 URL 信息（通过 middleware 设置）
    const pathname = headersList.get("x-current-path") || "/";
    const fullUrl = headersList.get("x-current-url") || "";
    const search = headersList.get("x-current-search") || "";

    console.log(pathname, "dddd", fullUrl);
    // 验证是否为有效的 locale
    const supportedLocales = [
      "en",
      "zh-Hans",
      "zh-Hant",
      "ko",
      "vi",
      "es",
      "tr",
      "de",
    ];

    // 从路径中提取语言代码
    const segments = pathname.split("/").filter(Boolean);
    let detectedLocale = "en"; // 默认语言

    if (segments.length > 0) {
      const potentialLocale = segments[0];

      if (supportedLocales.includes(potentialLocale)) {
        detectedLocale = potentialLocale;
      }
    }

    // 调试信息
    if (process.env.NODE_ENV === "development") {
      console.log("[Locale API] Current pathname:", pathname);
      console.log("[Locale API] Full URL:", fullUrl);
      console.log("[Locale API] Potential locale:", segments[0]);
      console.log("[Locale API] Detected locale:", detectedLocale);
    }

    // 返回语言信息
    return NextResponse.json({
      success: true,
      data: {
        locale: detectedLocale,
        pathname,
        fullUrl,
        search,
        segments,
        isValidLocale: supportedLocales.includes(segments[0] || ""),
      },
    });
  } catch (error) {
    console.error("Error in locale API:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to detect locale",
        message: error instanceof Error ? error.message : "Unknown error",
        data: {
          locale: "en", // 返回默认语言
          pathname: "/",
          fullUrl: "",
          search: "",
          segments: [],
          isValidLocale: false,
        },
      },
      { status: 500 }
    );
  }
}
