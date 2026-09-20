import { describe, expect, it } from "vitest";
import { API_VERSION, CLOSE_CODES, LIMITS } from "@sr/protocol";

describe("قرارداد realtime", () => {
  it("نسخه‌ی API عدد صحیح مثبت است", () => {
    expect(Number.isInteger(API_VERSION)).toBe(true);
    expect(API_VERSION).toBeGreaterThanOrEqual(4);
  });

  it("کدهای بستن سوکت در بازه‌ی خصوصی هستند", () => {
    for (const code of Object.values(CLOSE_CODES)) {
      expect(code).toBeGreaterThanOrEqual(4000);
      expect(code).toBeLessThan(5000);
    }
    expect(new Set(Object.values(CLOSE_CODES)).size).toBe(Object.keys(CLOSE_CODES).length);
  });

  it("محدودیت‌ها منطقی‌اند", () => {
    expect(LIMITS.messageLength).toBeGreaterThan(0);
    expect(LIMITS.avatarBytes).toBeLessThan(LIMITS.attachmentBytes);
    expect(LIMITS.heartbeatTimeoutMs).toBeGreaterThan(LIMITS.heartbeatMs);
    expect(LIMITS.attachmentsPerMessage).toBeGreaterThan(0);
  });
});
