/* SR-Connect — سرویس‌ورکر فاز ۱
 * مسئولیت: پوسته‌ی اپ آفلاین بالا بیاید و نسخه‌ی جدید فقط با اجازه‌ی
 * آپدیت‌کننده (پیام SR_SKIP_WAITING) فعال شود، نه وسط کار کاربر.
 */

const VERSION = "0.1.4";
const SHELL = `sr-shell-v${VERSION}`;

const PRECACHE = ["/", "/login", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  // خودبه‌خود فعال نمی‌شویم؛ منتظر دستور می‌مانیم.
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).catch(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SR_SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "SR_VERSION") {
    event.source?.postMessage({ type: "SR_VERSION_RESULT", version: VERSION });
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // نسخه و بسته‌ها هیچ‌وقت کش نمی‌شوند — وگرنه آپدیت گیر می‌کند.
  if (url.pathname.startsWith("/api/")) return;

  // ناوبری: اول شبکه، اگر نبود از کش (اپ آفلاین هم باز می‌شود)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((m) => m ?? caches.match("/"))),
    );
    return;
  }

  // دارایی‌های ثابت: اول کش
  event.respondWith(
    caches.match(req).then(
      (m) =>
        m ??
        fetch(req).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
