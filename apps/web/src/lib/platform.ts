export type Platform = "web" | "pwa" | "tauri" | "android" | "ios" | "unknown";

/** تشخیص بستر اجرا؛ سازوکار نصب آپدیت برای هرکدام متفاوت است. */
export function detectPlatform(): Platform {
  if (typeof window === "undefined") return "unknown";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__) return "tauri";

  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";

  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).standalone === true;

  return standalone ? "pwa" : "web";
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  web: "مرورگر",
  pwa: "اپ نصب‌شده (PWA)",
  tauri: "دسکتاپ",
  android: "اندروید",
  ios: "iOS",
  unknown: "نامشخص",
};
