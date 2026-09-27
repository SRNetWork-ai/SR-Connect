"use client";

/**
 * فهرست میان‌بُرها در یک جا.
 *
 * هم صفحه‌ی تنظیمات از همین فهرست خوانده می‌شود و هم لایه‌ی شنونده،
 * تا هیچ‌وقت راهنما با رفتار واقعی اپ اختلاف پیدا نکند.
 */

export interface Hotkey {
  id: string;
  /** برای نمایش؛ ترتیب همان چیزی است که کاربر می‌بیند. */
  keys: string[];
  label: string;
}

export const HOTKEYS: Hotkey[] = [
  { id: "quickSwitcher", keys: ["Ctrl", "K"], label: "پرش سریع و جست‌وجوی پیام" },
  { id: "search", keys: ["Ctrl", "Shift", "F"], label: "جست‌وجو در پیام‌ها" },
  { id: "mute", keys: ["Ctrl", "Shift", "M"], label: "بی‌صدا کردن میکروفون" },
  { id: "deafen", keys: ["Ctrl", "Shift", "D"], label: "قطع کردن صدا" },
  { id: "nextChannel", keys: ["Alt", "↓"], label: "کانال بعدی" },
  { id: "prevChannel", keys: ["Alt", "↑"], label: "کانال قبلی" },
  { id: "settings", keys: ["Ctrl", ","], label: "تنظیمات" },
  { id: "close", keys: ["Esc"], label: "بستن پنجره‌ی باز" },
];

/** کاربر وسط تایپ است؟ آن‌وقت حرف‌ها را نباید به میان‌بُر ترجمه کرد. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  // Boolean لازم است: روی عناصری که این ویژگی را ندارند، undefined برمی‌گردد.
  return Boolean(el.isContentEditable);
}
