import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIp, rateLimit } from "@/lib/rate-limit";

describe("محدودکننده‌ی نرخ", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("تا سقف اجازه می‌دهد و بعد می‌بندد", () => {
    const key = `t-${Math.random()}`;
    for (let i = 0; i < 5; i += 1) expect(rateLimit(key, 5, 60_000).ok).toBe(true);
    const blocked = rateLimit(key, 5, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("سطل با گذر زمان دوباره پر می‌شود", () => {
    const key = `t-${Math.random()}`;
    for (let i = 0; i < 3; i += 1) rateLimit(key, 3, 30_000);
    expect(rateLimit(key, 3, 30_000).ok).toBe(false);

    vi.advanceTimersByTime(11_000); // یک توکن ≈ ۱۰ ثانیه
    expect(rateLimit(key, 3, 30_000).ok).toBe(true);
  });

  it("کلیدهای مختلف سطل جدا دارند", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(rateLimit(a, 1, 60_000).ok).toBe(true);
    expect(rateLimit(a, 1, 60_000).ok).toBe(false);
    expect(rateLimit(b, 1, 60_000).ok).toBe(true);
  });

  it("IP را از هدر پراکسی می‌خواند", () => {
    const req = new Request("https://x.test/", {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("1.2.3.4");
    expect(clientIp(new Request("https://x.test/"))).toBe("unknown");
  });
});
