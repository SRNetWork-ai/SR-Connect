"use client";

import { useEffect } from "react";

/**
 * ثبت سرویس‌ورکر. فقط ثبت می‌کند؛ فعال‌سازی نسخه‌ی جدید دست
 * `installUpdate()` است تا آپدیت هیچ‌وقت وسط کار کاربر اتفاق نیفتد.
 */
export function SwRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((err) => console.warn("[sw] registration failed", err));
  }, []);

  return null;
}
