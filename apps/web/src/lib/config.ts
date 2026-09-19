/**
 * تنظیمات کلاینت. همه‌چیز از env می‌آید تا یک بیلد بتواند به هر سرور خودی وصل شود.
 */

export const APP_NAME = "SR-Connect";

/** نسخه‌ی این بیلد کلاینت. در CI از تگ گیت پر می‌شود. */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";

/** نسخه‌ی قراردادِ API که این کلاینت می‌فهمد. */
export const CLIENT_API_VERSION = Number(process.env.NEXT_PUBLIC_API_VERSION ?? 3);

export type UpdateChannel = "stable" | "beta" | "nightly";

export const UPDATE_CHANNEL = (process.env.NEXT_PUBLIC_UPDATE_CHANNEL ??
  "stable") as UpdateChannel;

/** کلید عمومی Ed25519 برای بررسی امضای بسته‌ی آپدیت (base64، raw 32 بایت). */
export const UPDATE_PUBKEY =
  process.env.NEXT_PUBLIC_UPDATE_PUBKEY ??
  // کلید دمو؛ در تولید با کلید واقعی جایگزین می‌شود.
  "kiFCRFXDnw45qH20n/a6+4XEhN0uOg8/Hm7DS7BktO4=";

/** آدرس سرور خودی. خالی = same-origin. */
export const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "";

export function serverEndpoint(path: string): string {
  const base = SERVER_URL.replace(/\/$/, "");
  return `${base}${path}`;
}

/**
 * انیمیشن‌های ورودی را کامل خاموش می‌کند.
 * برای تست بصری/اسکرین‌شات خودکار و کاربرانی که انیمیشن نمی‌خواهند.
 */
export const FORCE_REDUCE_MOTION = process.env.NEXT_PUBLIC_REDUCE_MOTION === "1";

/** قانون طلایی: بررسی نسخه هیچ‌وقت بیشتر از این مقدار اپ را نگه نمی‌دارد. */
export const VERSION_CHECK_TIMEOUT_MS = 2_000;

/** حداکثر زمانی که اسپلش اجازه دارد روی صفحه بماند (بدون آپدیت اجباری). */
export const SPLASH_BUDGET_MS = 6_000;

/** بعد از این تعداد کرشِ پشت‌سرهم، به نسخه‌ی قبلی برمی‌گردیم. */
export const CRASH_ROLLBACK_THRESHOLD = 2;
