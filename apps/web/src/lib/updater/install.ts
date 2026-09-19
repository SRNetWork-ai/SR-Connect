import { detectPlatform } from "@/lib/platform";
import type { Artifact } from "./types";

/**
 * پوسته‌ی بومی (Tauri / اپ موبایل) این شیء را روی window ثبت می‌کند.
 * وب هیچ‌وقت به آن وابسته نیست، پس بیلد وب بدون پکیج‌های بومی هم کار می‌کند.
 */
export interface NativeUpdater {
  install(bytes: Uint8Array, meta: { version: string; artifact: Artifact }): Promise<void>;
  relaunch(): Promise<void>;
}

declare global {
  interface Window {
    __SR_UPDATER__?: NativeUpdater;
  }
}

export interface InstallResult {
  mechanism: "service-worker" | "native" | "none";
  requiresReload: boolean;
  detail: string;
}

/** آپدیت PWA: سرویس‌ورکر جدید را فعال می‌کنیم و در بوت بعدی سرو می‌شود. */
async function installViaServiceWorker(): Promise<InstallResult> {
  if (!("serviceWorker" in navigator)) {
    return {
      mechanism: "none",
      requiresReload: false,
      detail: "سرویس‌ورکر در دسترس نیست؛ بسته در بوت بعدی از شبکه می‌آید",
    };
  }

  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    return {
      mechanism: "none",
      requiresReload: false,
      detail: "سرویس‌ورکری ثبت نشده است",
    };
  }

  await reg.update();
  const worker = reg.installing ?? reg.waiting;
  if (!worker) {
    return { mechanism: "service-worker", requiresReload: false, detail: "کش از قبل تازه بود" };
  }

  await new Promise<void>((resolve) => {
    const done = () => {
      if (worker.state === "installed" || worker.state === "activated") resolve();
    };
    worker.addEventListener("statechange", done);
    done();
    setTimeout(resolve, 5_000);
  });

  worker.postMessage({ type: "SR_SKIP_WAITING" });
  return {
    mechanism: "service-worker",
    requiresReload: true,
    detail: "نسخه‌ی جدید فعال شد",
  };
}

export async function installUpdate(
  bytes: Uint8Array,
  meta: { version: string; artifact: Artifact },
): Promise<InstallResult> {
  const native = typeof window !== "undefined" ? window.__SR_UPDATER__ : undefined;

  if (native) {
    await native.install(bytes, meta);
    return {
      mechanism: "native",
      requiresReload: true,
      detail: `نسخه ${meta.version} روی ${detectPlatform()} نصب شد`,
    };
  }

  return installViaServiceWorker();
}

export async function relaunch(): Promise<void> {
  const native = typeof window !== "undefined" ? window.__SR_UPDATER__ : undefined;
  if (native) return native.relaunch();
  window.location.reload();
}
