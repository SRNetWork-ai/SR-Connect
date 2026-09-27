"use client";

const KEY = "sr:auto-update";

/** به‌روزرسانی خودکار پیش‌فرض روشن است؛ کاربر می‌تواند خاموشش کند. */
export function autoUpdateEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) !== "off";
}

export function setAutoUpdateEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, enabled ? "on" : "off");
}
