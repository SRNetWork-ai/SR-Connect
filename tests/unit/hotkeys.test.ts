import { describe, expect, it } from "vitest";
import { HOTKEYS, isTypingTarget } from "@/lib/hotkeys";

describe("میان‌بُرها", () => {
  it("هیچ دو میان‌بُری ترکیب کلید یکسان ندارند", () => {
    const combos = HOTKEYS.map((h) => h.keys.join("+"));
    expect(new Set(combos).size).toBe(combos.length);
  });

  it("همه‌ی میان‌بُرها برچسب فارسی دارند", () => {
    for (const hotkey of HOTKEYS) {
      expect(hotkey.label.trim().length).toBeGreaterThan(0);
      expect(hotkey.keys.length).toBeGreaterThan(0);
    }
  });

  it("وسط تایپ، کلید به میان‌بُر ترجمه نمی‌شود", () => {
    expect(isTypingTarget({ tagName: "INPUT" } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA" } as unknown as EventTarget)).toBe(true);
    expect(
      isTypingTarget({ tagName: "DIV", isContentEditable: true } as unknown as EventTarget),
    ).toBe(true);
  });

  it("روی دکمه و بدنه، میان‌بُر آزاد است", () => {
    expect(isTypingTarget({ tagName: "BUTTON" } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
