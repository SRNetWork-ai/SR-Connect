import { APP_VERSION, CRASH_ROLLBACK_THRESHOLD } from "@/lib/config";

/**
 * نگهبان کرش.
 * هر بوت یک «نشانه‌ی در جریان» می‌گذارد. اگر اپ سالم بالا بیاید پاک می‌شود.
 * اگر چند بوت پشت‌سرهم بدون رسیدن به حالت سالم تمام شوند، یعنی نسخه‌ی جدید
 * خراب است و باید به آخرین نسخه‌ی سالم برگردیم.
 */

const K = {
  pending: "sr.boot.pending",
  version: "sr.boot.version",
  lastGood: "sr.version.lastGood",
} as const;

const store = () => (typeof localStorage === "undefined" ? null : localStorage);

const num = (v: string | null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** ابتدای بوت صدا زده می‌شود. تعداد بوت‌های ناتمام را برمی‌گرداند. */
export function beginBoot(): number {
  const s = store();
  if (!s) return 0;

  // اگر نسخه عوض شده، شمارنده از صفر شروع می‌شود.
  if (s.getItem(K.version) !== APP_VERSION) {
    s.setItem(K.version, APP_VERSION);
    s.setItem(K.pending, "0");
  }

  const pending = num(s.getItem(K.pending)) + 1;
  s.setItem(K.pending, String(pending));
  return pending - 1; // تعداد بوت‌های قبلیِ ناتمام
}

/** وقتی اپ واقعاً بالا آمد. نسخه‌ی فعلی «سالم» علامت می‌خورد. */
export function markBootHealthy(): void {
  const s = store();
  if (!s) return;
  s.setItem(K.pending, "0");
  s.setItem(K.lastGood, APP_VERSION);
}

export function lastGoodVersion(): string | null {
  const s = store();
  const v = s?.getItem(K.lastGood) ?? null;
  return v && v !== APP_VERSION ? v : null;
}

/**
 * آیا باید رول‌بک کنیم؟ شرط: حد کرش رد شده باشد و نسخه‌ی سالمِ قبلی بشناسیم.
 */
export function shouldRollback(): { rollback: boolean; to?: string; crashes: number } {
  const crashes = num(store()?.getItem(K.pending) ?? null) - 1;
  const to = lastGoodVersion();
  return {
    rollback: crashes >= CRASH_ROLLBACK_THRESHOLD && !!to,
    to: to ?? undefined,
    crashes: Math.max(crashes, 0),
  };
}

export function resetCrashGuard(): void {
  const s = store();
  if (!s) return;
  s.setItem(K.pending, "0");
}
