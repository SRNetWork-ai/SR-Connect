import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, PERMISSION_BITS, effectivePermissions, has, maskOf } from "@sr/protocol";

describe("ماسک دسترسی‌ها", () => {
  it("هر دسترسی یک بیت یکتا دارد", () => {
    const bits = Object.values(PERMISSION_BITS);
    expect(new Set(bits).size).toBe(bits.length);
    for (const b of bits) expect(Number.isInteger(Math.log2(b))).toBe(true);
  });

  it("has فقط بیت خودش را می‌بیند", () => {
    const mask = maskOf("SEND_MESSAGE", "ADD_REACTION");
    expect(has(mask, "SEND_MESSAGE")).toBe(true);
    expect(has(mask, "ADD_REACTION")).toBe(true);
    expect(has(mask, "MANAGE_ROLES")).toBe(false);
  });

  it("ADMINISTRATOR همه‌ی دسترسی‌ها را می‌دهد", () => {
    const admin = maskOf("ADMINISTRATOR");
    expect(has(admin, "MANAGE_ROLES")).toBe(true);
    expect(has(admin, "CONNECT_VOICE")).toBe(true);
  });

  it("ALL_PERMISSIONS شامل همه‌ی بیت‌هاست", () => {
    for (const name of Object.keys(PERMISSION_BITS) as (keyof typeof PERMISSION_BITS)[]) {
      expect(has(ALL_PERMISSIONS, name)).toBe(true);
    }
  });

  it("deny روی allow اولویت دارد", () => {
    const base = maskOf("VIEW_CHANNEL", "SEND_MESSAGE");
    const result = effectivePermissions(
      [base],
      [{ allow: PERMISSION_BITS.ATTACH_FILES, deny: PERMISSION_BITS.SEND_MESSAGE }],
    );
    expect(has(result, "ATTACH_FILES")).toBe(true);
    expect(has(result, "SEND_MESSAGE")).toBe(false);
    expect(has(result, "VIEW_CHANNEL")).toBe(true);
  });

  it("نقش‌های چندگانه با OR جمع می‌شوند", () => {
    const merged = effectivePermissions([maskOf("VIEW_CHANNEL"), maskOf("CONNECT_VOICE")]);
    expect(has(merged, "VIEW_CHANNEL")).toBe(true);
    expect(has(merged, "CONNECT_VOICE")).toBe(true);
  });
});
