import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";

/**
 * ذخیره‌ی فایل روی دیسک. عمداً از S3 خبری نیست — این پروژه self-hosted است
 * و یک volume ساده کافی است. مسیر از بیرون قابل حدس نیست چون نام فایل هش می‌شود.
 */
export const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "/srv/uploads";

/** فقط این نوع‌ها اجازه دارند. هر چیز دیگری به‌عنوان دانلود خام سرو می‌شود. */
const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);

const ALLOWED_MIME = new Set([
  ...IMAGE_MIME,
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "application/pdf",
  "application/zip",
  "text/plain",
  "application/json",
]);

export function isImage(mime: string): boolean {
  return IMAGE_MIME.has(mime);
}

export function mimeAllowed(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}

/** نام امن: هیچ بخشی از نام کاربر وارد مسیر فایل نمی‌شود. */
export function safeStoredName(originalName: string): string {
  const ext = extname(originalName)
    .toLowerCase()
    .slice(0, 10)
    .replace(/[^a-z0-9.]/g, "");
  return `${randomUUID()}${ext || ""}`;
}

export interface StoredFile {
  stored: string;
  size: number;
  sha256: string;
}

export async function storeFile(bytes: Uint8Array, originalName: string): Promise<StoredFile> {
  await mkdir(UPLOADS_DIR, { recursive: true });
  const stored = safeStoredName(originalName);
  await writeFile(join(UPLOADS_DIR, stored), bytes, { mode: 0o640 });
  return {
    stored,
    size: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

/**
 * ابعاد تصویر را بدون کتابخانه‌ی خارجی از هدر فایل می‌خواند.
 * فقط برای رزرو فضا در UI است تا هنگام لود، چیدمان نپرد.
 */
export function imageSize(buf: Uint8Array): { width: number; height: number } | null {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  try {
    // PNG
    if (buf[0] === 0x89 && buf[1] === 0x50) {
      return { width: dv.getUint32(16), height: dv.getUint32(20) };
    }
    // GIF
    if (buf[0] === 0x47 && buf[1] === 0x49) {
      return { width: dv.getUint16(6, true), height: dv.getUint16(8, true) };
    }
    // JPEG — تا SOF جلو می‌رویم
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let o = 2;
      while (o < buf.byteLength) {
        if (buf[o] !== 0xff) break;
        const marker = buf[o + 1]!;
        const len = dv.getUint16(o + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: dv.getUint16(o + 5), width: dv.getUint16(o + 7) };
        }
        o += 2 + len;
      }
    }
    // WebP (VP8X / VP8L / VP8)
    if (buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
      const fourcc = String.fromCharCode(buf[12]!, buf[13]!, buf[14]!, buf[15]!);
      if (fourcc === "VP8X") {
        const w = 1 + (buf[24]! | (buf[25]! << 8) | (buf[26]! << 16));
        const h = 1 + (buf[27]! | (buf[28]! << 8) | (buf[29]! << 16));
        return { width: w, height: h };
      }
      if (fourcc === "VP8 ") {
        return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
      }
    }
  } catch {
    /* هدر ناقص — بی‌خیال ابعاد */
  }
  return null;
}
