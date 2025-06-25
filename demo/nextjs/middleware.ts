import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 中间件没执行？？？？
export function middleware(request: NextRequest) {
  // 创建新的请求头
  const headers = new Headers(request.headers);

  // 输出详细的请求信息
  console.log("=".repeat(50));
  console.log("🚀 MIDDLEWARE EXECUTING");
  console.log("📍 Path:", request.nextUrl.pathname);
  console.log("🌐 Full URL:", request.nextUrl.href);
  console.log("🔍 Search:", request.nextUrl.search);
  console.log("📝 Method:", request.method);
  console.log("⏰ Time:", new Date().toISOString());
  console.log("=".repeat(50));

  // 将当前路径添加到请求头中
  headers.set("x-current-path", request.nextUrl.pathname);

  // 将搜索参数也添加到请求头中（如果需要的话）
  headers.set("x-current-search", request.nextUrl.search);

  // 将完整 URL 添加到请求头中
  headers.set("x-current-url", request.nextUrl.href);

  return NextResponse.next({ headers });
}

// // 配置 middleware 匹配规则
// export const config = {
//   // 匹配所有路径，包括 API 路由，但排除静态文件等
//   matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
// };
