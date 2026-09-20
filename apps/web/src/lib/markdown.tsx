"use client";

import { Fragment, useState, type ReactNode } from "react";
import { isJumbo, toBlocks, tokenize, type Token } from "@/lib/markdown-parse";

/**
 * مارک‌داون سبک، بدون dangerouslySetInnerHTML.
 * همه‌چیز به گره‌های React تبدیل می‌شود، پس XSS از ریشه بسته است.
 * پشتیبانی: ```block``` · `inline` · **bold** · *italic* · __underline__
 *           ~~strike~~ · ||spoiler|| · > quote · - list · لینک · <@mention>
 */

export interface MarkdownOptions {
  /** نگاشت شناسه‌ی کاربر به نام نمایشی برای منشن‌ها. */
  names?: Record<string, string>;
  /** شناسه‌ی بیننده تا منشن خودش برجسته شود. */
  meId?: string;
}

export { isJumbo };

function Spoiler({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="md-spoiler"
      data-open={open}
      role="button"
      tabIndex={0}
      onClick={() => setOpen(true)}
      onKeyDown={(e) => e.key === "Enter" && setOpen(true)}
    >
      {children}
    </span>
  );
}

function render(tokens: Token[], opts: MarkdownOptions, key: string): ReactNode[] {
  return tokens.map((tk, i) => {
    const k = `${key}-${i}`;
    switch (tk.t) {
      case "text":
        return <Fragment key={k}>{tk.value}</Fragment>;
      case "code":
        return (
          <code key={k} className="md-inline-code">
            {tk.value}
          </code>
        );
      case "spoiler":
        return <Spoiler key={k}>{render(tk.children, opts, k)}</Spoiler>;
      case "bold":
        return (
          <strong key={k} className="font-bold text-t1">
            {render(tk.children, opts, k)}
          </strong>
        );
      case "italic":
        return <em key={k}>{render(tk.children, opts, k)}</em>;
      case "underline":
        return <u key={k}>{render(tk.children, opts, k)}</u>;
      case "strike":
        return (
          <s key={k} className="opacity-70">
            {render(tk.children, opts, k)}
          </s>
        );
      case "mention":
        return (
          <span key={k} className="md-mention" data-me={opts.meId === tk.id}>
            @{opts.names?.[tk.id] ?? "کاربر"}
          </span>
        );
      case "link":
        return (
          <a
            key={k}
            href={tk.href}
            target="_blank"
            rel="noreferrer noopener nofollow"
            className="md-link"
            dir="ltr"
          >
            {tk.href.length > 64 ? `${tk.href.slice(0, 61)}…` : tk.href}
          </a>
        );
      default:
        return null;
    }
  });
}

export function Markdown({
  content,
  options = {},
  className,
}: {
  content: string;
  options?: MarkdownOptions;
  className?: string;
}) {
  const jumbo = isJumbo(content);
  const blocks = toBlocks(content);

  return (
    <div className={className}>
      {blocks.map((b, bi) => {
        if (b.kind === "code") {
          return (
            <pre key={bi} className="md-code-block" dir="ltr">
              {b.lang && <span className="mb-1 block text-2xs text-t5 select-none">{b.lang}</span>}
              <code>{b.lines.join("\n")}</code>
            </pre>
          );
        }
        if (b.kind === "quote") {
          return (
            <blockquote key={bi} className="md-quote">
              {b.lines.map((l, li) => (
                <p key={li} className="break-words whitespace-pre-wrap">
                  {render(tokenize(l), options, `q${bi}-${li}`)}
                </p>
              ))}
            </blockquote>
          );
        }
        if (b.kind === "list") {
          return (
            <ul key={bi} className="my-0.5 list-disc space-y-0.5 ps-5">
              {b.lines.map((l, li) => (
                <li key={li} className="break-words">
                  {render(tokenize(l), options, `l${bi}-${li}`)}
                </li>
              ))}
            </ul>
          );
        }
        const text = b.lines.join("\n").replace(/\n{3,}/g, "\n\n");
        if (!text.trim()) return null;
        return (
          <p key={bi} className={`break-words whitespace-pre-wrap ${jumbo ? "md-jumbo" : ""}`}>
            {render(tokenize(text), options, `t${bi}`)}
          </p>
        );
      })}
    </div>
  );
}
