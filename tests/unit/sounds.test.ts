import { beforeEach, describe, expect, it, vi } from "vitest";

/** localStorage ساده برای محیط node. */
const store = new Map<string, string>();
vi.stubGlobal("window", {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  },
});

const { soundsEnabled, setSoundsEnabled, soundVolume, setSoundVolume, playSound } =
  await import("@/lib/sounds");

describe("sounds", () => {
  beforeEach(() => store.clear());

  it("پیش‌فرض روشن است", () => {
    expect(soundsEnabled()).toBe(true);
  });

  it("خاموش کردن ذخیره می‌شود", () => {
    setSoundsEnabled(false);
    expect(soundsEnabled()).toBe(false);
    setSoundsEnabled(true);
    expect(soundsEnabled()).toBe(true);
  });

  it("بلندی پیش‌فرض نیمه است و بازه را رعایت می‌کند", () => {
    expect(soundVolume()).toBe(0.5);
    setSoundVolume(2);
    expect(soundVolume()).toBe(1);
    setSoundVolume(-1);
    expect(soundVolume()).toBe(0);
  });

  /** بدون AudioContext نباید خطا بدهد — مرورگرهای قدیمی و SSR. */
  it("بدون پشتیبانی صوتی بی‌سروصدا رد می‌شود", () => {
    expect(() => playSound("join")).not.toThrow();
  });
});
