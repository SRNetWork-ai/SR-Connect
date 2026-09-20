import { describe, expect, it } from "vitest";
import { compare, gt, isValid, lt, parse } from "@/lib/updater/semver";

describe("semver", () => {
  it("نسخه‌های معتبر را می‌شناسد", () => {
    expect(isValid("1.2.3")).toBe(true);
    expect(isValid("v1.2.3")).toBe(true);
    expect(isValid("1.2.3-beta.1")).toBe(true);
    expect(isValid("1.2")).toBe(false);
    expect(isValid("سلام")).toBe(false);
  });

  it("ترتیب عددی درست است", () => {
    expect(gt("1.2.4", "1.2.3")).toBe(true);
    expect(gt("1.3.0", "1.2.99")).toBe(true);
    expect(gt("2.0.0", "1.99.99")).toBe(true);
    expect(compare("1.2.3", "1.2.3")).toBe(0);
  });

  it("نسخه‌ی پایدار از pre-release بالاتر است", () => {
    expect(gt("1.0.0", "1.0.0-rc.1")).toBe(true);
    expect(lt("1.0.0-beta", "1.0.0")).toBe(true);
    expect(gt("1.0.0-rc.2", "1.0.0-rc.1")).toBe(true);
  });

  it("نسخه‌ی نامعتبر کوچک‌تر حساب می‌شود", () => {
    expect(compare("خراب", "1.0.0")).toBe(-1);
    expect(compare("1.0.0", "خراب")).toBe(1);
    expect(compare("خراب", "بدتر")).toBe(0);
  });

  it("پیشوند v نادیده گرفته می‌شود", () => {
    expect(parse("v3.1.4")?.core).toEqual([3, 1, 4]);
    expect(compare("v1.0.0", "1.0.0")).toBe(0);
  });
});
