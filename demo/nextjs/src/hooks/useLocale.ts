"use client";
import { useParams, usePathname } from "next/navigation";
import { useMemo } from "react";
import { I18nUtil } from "@utils";

/**
 * 安全地获取当前 locale 的 hook，确保 SSR 和客户端一致
 * @returns {Object} 包含 locale 的对象
 */
export function useLocale() {
  const params = useParams() as { locale: string };
  const pathname = usePathname();

  // 从路径或参数中获取 locale，确保 SSR 和客户端一致
  const locale = useMemo(() => {
    // 首先尝试从 params 获取
    if (params?.locale) {
      return params.locale;
    }

    // 如果 params 不可用，从 pathname 解析
    if (pathname) {
      const segments = pathname.split("/").filter(Boolean);
      if (segments.length > 0) {
        const potentialLocale = segments[0];
        // 验证是否为有效的 locale
        if (I18nUtil.isValidLocale(potentialLocale)) {
          return potentialLocale;
        }
      }
    }

    // 默认返回英文
    return "en";
  }, [params?.locale, pathname]);

  return {
    locale,
  };
}
