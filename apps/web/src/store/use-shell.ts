"use client";

import { create } from "zustand";

export type ShellView = "friends" | "chat" | "updates" | "accountSettings" | "serverSettings";

export const VIEW_PATH: Record<ShellView, string> = {
  friends: "/app/friends",
  chat: "/app",
  updates: "/app/updates",
  accountSettings: "/app/settings",
  serverSettings: "/app/server-settings",
};

export const VIEW_TITLE: Record<ShellView, string> = {
  friends: "دوستان و پیام‌های خصوصی · SR-Connect",
  chat: "گفت‌وگوی عمومی · SR-Connect",
  updates: "مرکز آپدیت · SR-Connect",
  accountSettings: "تنظیمات حساب · SR-Connect",
  serverSettings: "تنظیمات سرور · SR-Connect",
};

interface ShellState {
  view: ShellView;
  /** جابه‌جایی بین نماها بدون رفت‌وبرگشت به سرور. */
  setView(view: ShellView, opts?: { replace?: boolean }): void;
}

/**
 * نمای فعال پوسته، سمت کلاینت.
 *
 * چرا استور و نه روتر Next: تنظیمات و مرکز آپدیت هر دو کلاینت‌ساید هستند و
 * هیچ داده‌ای از سرور لازم ندارند. اگر با <Link> برویم، هر کلیک یک رفت‌وبرگشت
 * RSC می‌شود که روی اینترنت کند «چند ثانیه» طول می‌کشد. با استور، جابه‌جایی
 * فوری است و URL را دستی هم‌گام می‌کنیم تا لینک مستقیم و دکمه‌ی back کار کند.
 */
export const useShell = create<ShellState>()((set, get) => ({
  view: "chat",

  setView(view, opts) {
    if (get().view === view) return;
    set({ view });
    if (typeof window === "undefined") return;
    const path = VIEW_PATH[view];
    if (window.location.pathname !== path) {
      if (opts?.replace) window.history.replaceState({ srView: view }, "", path);
      else window.history.pushState({ srView: view }, "", path);
    }
    document.title = VIEW_TITLE[view];
  },
}));

/** تشخیص نما از مسیر — برای بارگذاری مستقیم و دکمه‌ی back. */
export function viewFromPath(pathname: string): ShellView {
  if (pathname.startsWith("/app/server-settings")) return "serverSettings";
  if (pathname.startsWith("/app/settings")) return "accountSettings";
  if (pathname.startsWith("/app/friends")) return "friends";
  if (pathname.startsWith("/app/updates")) return "updates";
  return "chat";
}
