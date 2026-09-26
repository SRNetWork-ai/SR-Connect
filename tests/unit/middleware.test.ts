import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

function request(url: string, cookie?: string) {
  const req = new NextRequest(new URL(url, "https://sr.example"));
  if (cookie) req.cookies.set("sr_session", cookie);
  return req;
}

describe("middleware", () => {
  it("بدون کوکی، /app به صفحه‌ی ورود می‌رود", () => {
    const res = middleware(request("/app"));
    expect(res.headers.get("location")).toContain("/login");
  });

  it("با کوکی، /login خالی به اپ برمی‌گردد", () => {
    const res = middleware(request("/login", "token"));
    expect(res.headers.get("location")).toContain("/app");
  });

  /**
   * محافظ باگ حلقه‌ی بی‌نهایت: کوکی مانده ولی نشست باطل است، اپ کاربر را
   * عمداً به /login فرستاده و میدل‌ور نباید دوباره او را به /app برگرداند.
   */
  it("با کوکی باطل و پرچم expired، به /app برنمی‌گردد", () => {
    const res = middleware(request("/login?expired=1&next=/app", "stale-token"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("با کوکی و پارامتر next هم برنمی‌گردد", () => {
    const res = middleware(request("/login?next=/app", "stale-token"));
    expect(res.headers.get("location")).toBeNull();
  });
});
