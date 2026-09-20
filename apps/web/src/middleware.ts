import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "sr_session";

/**
 * CSP سخت‌گیرانه با nonce.
 * اسکریپت‌های خود Next با همین nonce امضا می‌شوند، پس هیچ inline script
 * ناشناخته‌ای اجرا نمی‌شود. برای style مجبوریم unsafe-inline نگه داریم چون
 * next/font و style attribute های React از آن استفاده می‌کنند — این بردار
 * اجرای کد ندارد.
 */
function csp(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'self'`,
    `form-action 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${dev ? "'unsafe-eval'" : ""}`.trim(),
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `media-src 'self' blob:`,
    `font-src 'self' data:`,
    // ws/wss برای گیت‌وی realtime و LiveKit روی همان دامنه یا زیردامنه‌ها.
    `connect-src 'self' ws: wss: blob:`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

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

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = csp(nonce);

  // هدر روی درخواست هم ست می‌شود تا Next همان nonce را روی تگ‌های script بگذارد.
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", policy);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set("content-security-policy", policy);
  return res;
}

export const config = {
  // فایل‌های ثابت و پیوست‌ها نیازی به CSP ندارند و نباید هزینه‌ی میدل‌ور بدهند.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/files|icons|fonts).*)"],
};
