import { createHash } from "node:crypto";

/**
 * وقتی هیچ ریلیز واقعی‌ای منتشر نشده، سرور یک آرتیفکت قطعی می‌سازد:
 * بایت‌ها از زنجیره‌ی SHA-256 تولید می‌شوند، پس همیشه یکسان‌اند و هشِ
 * مانیفست با بایت‌های دانلودشده می‌خواند. یعنی مسیر «دانلود → بررسی امضا»
 * حتی قبل از اولین انتشار هم واقعاً تست می‌شود.
 */
export const DEV_FULL_SIZE = 1_835_008; // ۱.۷۵ مگابایت
export const DEV_DELTA_RATIO = 0.18;

export function devBytes(seed: string, size: number): Buffer {
  const out = Buffer.alloc(size);
  let block = createHash("sha256").update(seed).digest();
  let offset = 0;
  while (offset < size) {
    block = createHash("sha256").update(block).digest();
    const n = Math.min(block.length, size - offset);
    block.copy(out, offset, 0, n);
    offset += n;
  }
  return out;
}

/** نام آرتیفکت توسعه را به seed و اندازه برمی‌گرداند. */
export function resolveDevArtifact(name: string): { seed: string; size: number } | null {
  const full = /^sr-connect-(.+)-full\.bin$/.exec(name);
  if (full) return { seed: `sr-connect:full:${full[1]}`, size: DEV_FULL_SIZE };

  const delta = /^sr-connect-(.+)-delta-from-(.+)\.bin$/.exec(name);
  if (delta) {
    return {
      seed: `sr-connect:delta:${delta[2]}->${delta[1]}`,
      size: Math.round(DEV_FULL_SIZE * DEV_DELTA_RATIO),
    };
  }
  return null;
}
