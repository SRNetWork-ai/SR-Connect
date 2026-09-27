"use client";

/**
 * اعلان دسکتاپ برای منشن و پیام خصوصی.
 *
 * چرا لازم است: تا حالا اگر پنجره پشت بقیه بود یا کاربر در کانال دیگری بود،
 * هیچ نشانه‌ای بیرون از اپ دیده نمی‌شد و پیام از دست می‌رفت.
 *
 * سه قاعده‌ی محافظه‌کارانه تا آزاردهنده نشود:
 *   ۱. فقط وقتی پنجره در دید نیست یا کانال پیام باز نیست
 *   ۲. هیچ‌وقت در حالت «مزاحم نشوید»
 *   ۳. هر کانال یک اعلان زنده دارد (tag) تا روی هم تلنبار نشود
 */

const PREF_KEY = "sr:desktop-notifications";

export type NotifyPermission = "unsupported" | "default" | "granted" | "denied";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notifyPermission(): NotifyPermission {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission as NotifyPermission;
}

/** پیش‌فرض روشن است؛ ارزشش از مزاحمتش بیشتر است. */
export function desktopNotificationsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PREF_KEY) !== "off";
}

export function setDesktopNotificationsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREF_KEY, enabled ? "on" : "off");
}

/** درخواست اجازه فقط با کلیک کاربر؛ مرورگرها درخواست خودکار را بلاک می‌کنند. */
export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission as NotifyPermission;
  try {
    return (await Notification.requestPermission()) as NotifyPermission;
  } catch {
    return "denied";
  }
}

export interface DesktopNotice {
  title: string;
  body: string;
  /** هم‌گروه‌ها جای هم را می‌گیرند؛ معمولاً شناسه‌ی کانال. */
  tag: string;
  /** با کلیک روی اعلان اجرا می‌شود — مثلاً رفتن به همان کانال. */
  onClick?: () => void;
}

/** آیا همین لحظه اعلان معنی دارد؟ کاربر که جلوی همان صفحه است، اعلان نمی‌خواهد. */
export function shouldNotify(opts: { channelVisible: boolean; dnd: boolean }): boolean {
  if (!notificationsSupported() || notifyPermission() !== "granted") return false;
  if (!desktopNotificationsEnabled() || opts.dnd) return false;
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    return !opts.channelVisible;
  }
  return true;
}

export function showDesktopNotice(notice: DesktopNotice): void {
  if (!notificationsSupported() || notifyPermission() !== "granted") return;
  try {
    const n = new Notification(notice.title, {
      body: notice.body.slice(0, 180),
      tag: notice.tag,
      icon: "/icon.svg",
      badge: "/icon.svg",
      silent: true, // صدا را خودمان با lib/sounds می‌زنیم تا دوبار پخش نشود
      lang: "fa",
      dir: "rtl",
    });
    n.onclick = () => {
      window.focus();
      notice.onClick?.();
      n.close();
    };
  } catch {
    // بعضی مرورگرها بدون سرویس‌ورکر اجازه نمی‌دهند؛ سکوت بهتر از کرش است.
  }
}
