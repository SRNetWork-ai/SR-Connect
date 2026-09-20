/**
 * تجزیه‌ی مارک‌داون سبک — بدون React، تا هم روی سرور قابل استفاده باشد
 * هم بدون DOM تست شود. رندر در markdown.tsx انجام می‌شود.
 */

export type BlockKind = "code" | "quote" | "list" | "text";

export interface Block {
  kind: BlockKind;
  lang?: string;
  lines: string[];
}

export type Token =
  | { t: "text"; value: string }
  | { t: "code"; value: string }
  | { t: "spoiler"; children: Token[] }
  | { t: "bold"; children: Token[] }
  | { t: "italic"; children: Token[] }
  | { t: "underline"; children: Token[] }
  | { t: "strike"; children: Token[] }
  | { t: "mention"; id: string }
  | { t: "link"; href: string };

const EMOJI_ONLY =
  /^(?:\s*(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F|\u200D)?\s*){1,6}$/u;

/** پیام‌هایی که فقط ایموجی دارند بزرگ‌تر نمایش داده می‌شوند. */
export function isJumbo(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 24) return false;
  return EMOJI_ONLY.test(trimmed);
}

export function toBlocks(src: string): Block[] {
  const lines = src.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const fence = /^```(\w+)?\s*$/.exec(line);
    if (fence) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i]!)) body.push(lines[i++]!);
      i += 1;
      blocks.push({ kind: "code", lang: fence[1], lines: body });
      continue;
    }
    if (/^>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!)) {
        body.push(lines[i++]!.replace(/^>\s?/, ""));
      }
      blocks.push({ kind: "quote", lines: body });
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!)) {
        body.push(lines[i++]!.replace(/^\s*[-*]\s+/, ""));
      }
      blocks.push({ kind: "list", lines: body });
      continue;
    }
    const body: string[] = [];
    while (
      i < lines.length &&
      !/^```/.test(lines[i]!) &&
      !/^>\s?/.test(lines[i]!) &&
      !/^\s*[-*]\s+/.test(lines[i]!)
    ) {
      body.push(lines[i++]!);
    }
    blocks.push({ kind: "text", lines: body });
  }
  return blocks;
}

/** توکن‌های درون‌خطی به ترتیب اولویت. */
const INLINE =
  /(`[^`\n]+`)|(\|\|[\s\S]+?\|\|)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(~~[^~\n]+~~)|(\*[^*\n]+\*)|(_[^_\n]+_)|(<@[0-9a-fA-F-]{6,36}>)|(https?:\/\/[^\s<>"']+)/;

export function tokenize(text: string, depth = 0): Token[] {
  const out: Token[] = [];
  let rest = text;
  if (depth > 6) return [{ t: "text", value: text }];

  while (rest.length) {
    const m = INLINE.exec(rest);
    if (!m || m.index === undefined) {
      out.push({ t: "text", value: rest });
      break;
    }
    if (m.index > 0) out.push({ t: "text", value: rest.slice(0, m.index) });
    const token = m[0];
    const inner = (n: number) => tokenize(token.slice(n, -n), depth + 1);

    if (m[1]) out.push({ t: "code", value: token.slice(1, -1) });
    else if (m[2]) out.push({ t: "spoiler", children: inner(2) });
    else if (m[3]) out.push({ t: "bold", children: inner(2) });
    else if (m[4]) out.push({ t: "underline", children: inner(2) });
    else if (m[5]) out.push({ t: "strike", children: inner(2) });
    else if (m[6] || m[7]) out.push({ t: "italic", children: inner(1) });
    else if (m[8]) out.push({ t: "mention", id: token.slice(2, -1) });
    else if (m[9]) out.push({ t: "link", href: token });

    rest = rest.slice(m.index + token.length);
  }
  return out;
}

/** فهرست شناسه‌های منشن‌شده — هم کلاینت و هم سرور از همین استفاده می‌کنند. */
export function mentionIds(content: string): string[] {
  const out = new Set<string>();
  for (const m of content.matchAll(/<@([0-9a-fA-F-]{36})>/g)) out.add(m[1]!.toLowerCase());
  return [...out];
}
