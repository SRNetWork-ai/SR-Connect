import { describe, expect, it } from "vitest";
import { sanitizeWelcome, WELCOME_DEFAULTS } from "@/lib/welcome";

describe("sanitizeWelcome", () => {
  it("مقادیر خالی را به پیش‌فرض برمی‌گرداند", () => {
    const out = sanitizeWelcome({ title: "   ", buttonLabel: "" }, WELCOME_DEFAULTS);
    expect(out.title).toBe(WELCOME_DEFAULTS.title);
    expect(out.buttonLabel).toBe(WELCOME_DEFAULTS.buttonLabel);
  });

  it("قوانین خالی را حذف و سقف ۱۰ را رعایت می‌کند", () => {
    const rules = Array.from({ length: 15 }, (_, index) => `قانون ${index}`);
    const out = sanitizeWelcome({ rules: [...rules, "", "   "] }, WELCOME_DEFAULTS);
    expect(out.rules).toHaveLength(10);
    expect(out.rules.every(Boolean)).toBe(true);
  });

  it("کانال بدون شناسه را کنار می‌گذارد و سقف ۵ را نگه می‌دارد", () => {
    const channels = Array.from({ length: 8 }, (_, index) => ({
      channelId: `c${index}`,
      description: "توضیح",
    }));
    const out = sanitizeWelcome(
      { channels: [...channels, { channelId: "", description: "بی‌کانال" }] },
      WELCOME_DEFAULTS,
    );
    expect(out.channels).toHaveLength(5);
    expect(out.channels.every((item) => item.channelId)).toBe(true);
  });

  it("متن‌های بلند را می‌برد", () => {
    const out = sanitizeWelcome({ description: "x".repeat(500) }, WELCOME_DEFAULTS);
    expect(out.description).toHaveLength(300);
  });
});
