import { describe, expect, it } from "vitest";
import { isJumbo, mentionIds, toBlocks, tokenize } from "@/lib/markdown-parse";

describe("تجزیه‌ی مارک‌داون", () => {
  it("بلوک کد را جدا می‌کند", () => {
    const blocks = toBlocks("سلام\n```ts\nconst a = 1;\n```\nبای");
    expect(blocks.map((b) => b.kind)).toEqual(["text", "code", "text"]);
    expect(blocks[1]!.lang).toBe("ts");
    expect(blocks[1]!.lines).toEqual(["const a = 1;"]);
  });

  it("نقل‌قول و لیست را می‌شناسد", () => {
    const blocks = toBlocks("> یک\n> دو\n- الف\n- ب");
    expect(blocks[0]!.kind).toBe("quote");
    expect(blocks[0]!.lines).toEqual(["یک", "دو"]);
    expect(blocks[1]!.kind).toBe("list");
    expect(blocks[1]!.lines).toEqual(["الف", "ب"]);
  });

  it("توکن‌های درون‌خطی را می‌سازد", () => {
    const tokens = tokenize("**پررنگ** و `کد` و ||راز||");
    expect(tokens.map((t) => t.t)).toContain("bold");
    expect(tokens.map((t) => t.t)).toContain("code");
    expect(tokens.map((t) => t.t)).toContain("spoiler");
  });

  it("لینک و منشن جدا می‌شوند", () => {
    const id = "11111111-2222-3333-4444-555555555555";
    const tokens = tokenize(`سلام <@${id}> برو https://example.com/x`);
    const mention = tokens.find((t) => t.t === "mention");
    const link = tokens.find((t) => t.t === "link");
    expect(mention && "id" in mention && mention.id).toBe(id);
    expect(link && "href" in link && link.href).toBe("https://example.com/x");
  });

  it("HTML خام هیچ‌وقت توکن نمی‌شود", () => {
    const tokens = tokenize("<script>alert(1)</script>");
    expect(tokens.every((t) => t.t === "text")).toBe(true);
  });

  it("پیام فقط-ایموجی بزرگ می‌شود", () => {
    expect(isJumbo("😀")).toBe(true);
    expect(isJumbo("😀 🎉 🔥")).toBe(true);
    expect(isJumbo("سلام 😀")).toBe(false);
    expect(isJumbo("")).toBe(false);
  });

  it("شناسه‌های منشن یکتا برمی‌گردند", () => {
    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(mentionIds(`<@${id}> و باز <@${id}>`)).toEqual([id]);
    expect(mentionIds("بدون منشن")).toEqual([]);
  });
});
