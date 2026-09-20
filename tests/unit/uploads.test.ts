import { describe, expect, it } from "vitest";
import { imageSize, isImage, mimeAllowed, safeStoredName } from "@/lib/uploads";

/** هدر کوچک PNG با ابعاد ۱۶×۳۲. */
function pngHeader(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(24);
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(buf.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return buf;
}

/** هدر GIF87a با ابعاد little-endian. */
function gifHeader(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(12);
  buf.set([0x47, 0x49, 0x46, 0x38, 0x37, 0x61], 0);
  const view = new DataView(buf.buffer);
  view.setUint16(6, width, true);
  view.setUint16(8, height, true);
  return buf;
}

describe("آپلود", () => {
  it("فقط نوع‌های مجاز پذیرفته می‌شوند", () => {
    expect(mimeAllowed("image/png")).toBe(true);
    expect(mimeAllowed("application/pdf")).toBe(true);
    expect(mimeAllowed("application/x-msdownload")).toBe(false);
    expect(mimeAllowed("text/html")).toBe(false);
    expect(mimeAllowed("image/svg+xml")).toBe(false);
  });

  it("تصویر بودن درست تشخیص داده می‌شود", () => {
    expect(isImage("image/webp")).toBe(true);
    expect(isImage("video/mp4")).toBe(false);
  });

  it("نام ذخیره‌شده هیچ بخشی از نام کاربر را نگه نمی‌دارد", () => {
    const name = safeStoredName("../../etc/passwd.PNG");
    expect(name).not.toContain("passwd");
    expect(name).not.toContain("/");
    expect(name.endsWith(".png")).toBe(true);
  });

  it("ابعاد PNG و GIF از هدر خوانده می‌شود", () => {
    expect(imageSize(pngHeader(16, 32))).toEqual({ width: 16, height: 32 });
    expect(imageSize(gifHeader(64, 48))).toEqual({ width: 64, height: 48 });
    expect(imageSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
