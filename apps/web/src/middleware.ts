import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "sr_session";

/**
 * نگهبان لبه: مسیرهای /app بدون کوکی نشست مستقیم به صفحه‌ی ورود می‌روند،
 * و کاربر واردشده با باز کردن /login به اپ برمی‌گردد.
 * اعتبار واقعی توکن سمت سرور بررسی می‌شود؛ این فقط جلوی پرش صفحه را می‌گیرد.
 */
export function middleware(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/app") && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if ((pathname === "/login" || pathname === "/register") && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login", "/register"],
};
