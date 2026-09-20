/**
 * محدودکننده‌ی نرخ درون‌حافظه‌ای (token bucket).
 *
 * چرا حافظه و نه ردیس: این پروژه روی یک سرور اجرا می‌شود و پروسه‌ی وب یکی است.
 * همین سطل ساده جلوی اسپم و brute-force را می‌گیرد بدون اینکه سرویس جدیدی
 * اضافه کنیم. اگر روزی چند اینستنس شد، فقط همین فایل باید عوض شود.
 */

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

/** هر ۵ دقیقه سطل‌های بی‌استفاده پاک می‌شوند تا حافظه نشت نکند. */
function sweep(now: number) {
  if (now - lastSweep < 300_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (now - b.updatedAt > 600_000) buckets.delete(key);
  }
}

export interface RateResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * @param key      شناسه‌ی یکتا، مثلاً `msg:<userId>` یا `login:<ip>`
 * @param limit    حداکثر تعداد در بازه
 * @param windowMs طول بازه به میلی‌ثانیه
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now);

  const refillPerMs = limit / windowMs;
  const bucket = buckets.get(key) ?? { tokens: limit, updatedAt: now };

  bucket.tokens = Math.min(limit, bucket.tokens + (now - bucket.updatedAt) * refillPerMs);
  bucket.updatedAt = now;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return { ok: false, remaining: 0, retryAfterMs: Math.ceil((1 - bucket.tokens) / refillPerMs) };
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return { ok: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 };
}

/** IP واقعی پشت Caddy. فقط برای rate limit استفاده می‌شود، نه برای احراز هویت. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export const RATE = {
  login: { limit: 8, windowMs: 60_000 },
  register: { limit: 4, windowMs: 300_000 },
  message: { limit: 45, windowMs: 60_000 },
  reaction: { limit: 60, windowMs: 60_000 },
  upload: { limit: 20, windowMs: 300_000 },
  edit: { limit: 30, windowMs: 60_000 },
  ticket: { limit: 30, windowMs: 60_000 },
} as const;
