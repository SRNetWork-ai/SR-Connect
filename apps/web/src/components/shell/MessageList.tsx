"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { ChatMessage } from "@sr/protocol";
import { useApp } from "@/store/use-app";

/** پیام‌های پشت‌سرهم از یک نفر در بازه‌ی ۵ دقیقه، یک گروه می‌شوند. */
function groupMessages(messages: ChatMessage[]) {
  const groups: { author: ChatMessage["author"]; createdAt: string; items: ChatMessage[] }[] = [];
  for (const m of messages) {
    const last = groups[groups.length - 1];
    const sameAuthor = last && last.author.id === m.author.id;
    const closeInTime =
      last && new Date(m.createdAt).getTime() - new Date(last.createdAt).getTime() < 5 * 60_000;
    if (sameAuthor && closeInTime) last.items.push(m);
    else groups.push({ author: m.author, createdAt: m.createdAt, items: [m] });
  }
  return groups;
}

const time = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" });

export function MessageList() {
  const channelId = useApp((s) => s.activeChannelId);
  const messages = useApp((s) => (s.activeChannelId ? (s.messages[s.activeChannelId] ?? []) : []));
  const hasMore = useApp((s) => (s.activeChannelId ? Boolean(s.hasMore[s.activeChannelId]) : false));
  const loading = useApp((s) =>
    s.activeChannelId ? Boolean(s.loadingHistory[s.activeChannelId]) : false,
  );
  const loadHistory = useApp((s) => s.loadHistory);
  const channel = useApp((s) => s.channels.find((c) => c.id === s.activeChannelId));

  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  const groups = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    // فقط اگر کاربر ته لیست است، خودکار اسکرول می‌کنیم.
    if (atBottom.current) scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length]);

  useEffect(() => {
    atBottom.current = true;
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [channelId]);

  return (
    <div
      ref={scroller}
      onScroll={(e) => {
        const el = e.currentTarget;
        atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        if (el.scrollTop < 120 && hasMore && !loading && channelId) {
          void loadHistory(channelId, { older: true });
        }
      }}
      className="scroll-y flex-1 px-4 py-4"
    >
      {hasMore && (
        <div className="flex justify-center pb-3">
          <button
            onClick={() => channelId && void loadHistory(channelId, { older: true })}
            className="flex items-center gap-1.5 rounded-pill bg-card px-3 py-1 text-xs text-t3 hover:bg-hover"
          >
            {loading && <Loader2 className="size-3 animate-spin" />}
            پیام‌های قدیمی‌تر
          </button>
        </div>
      )}

      {messages.length === 0 && !loading && (
        <div className="grid h-full place-items-center text-center">
          <div>
            <p className="text-lg font-bold text-t2">اینجا خالی است</p>
            <p className="mt-1 text-sm text-t4">
              {channel ? `اولین پیام کانال ${channel.name} را بنویس.` : "یک کانال انتخاب کن."}
            </p>
          </div>
        </div>
      )}

      {groups.map((group, gi) => {
        const prev = groups[gi - 1];
        const newDay =
          !prev ||
          new Date(prev.createdAt).toDateString() !== new Date(group.createdAt).toDateString();
        return (
          <div key={group.items[0]!.id}>
            {newDay && (
              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-divider" />
                <span className="text-2xs text-t4">{day.format(new Date(group.createdAt))}</span>
                <span className="h-px flex-1 bg-divider" />
              </div>
            )}
            <div className="group flex gap-3 py-1.5 hover:bg-[#2e3035]/40">
              <span
                className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                style={{ background: group.author.avatarColor }}
              >
                {group.author.displayName[0]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-semibold text-t1">
                    {group.author.displayName}
                  </span>
                  <span className="text-2xs text-t4">
                    {time.format(new Date(group.createdAt))}
                  </span>
                </div>
                {group.items.map((m) => (
                  <p
                    key={m.id}
                    className={`text-base break-words whitespace-pre-wrap ${
                      m.system ? "text-t4 italic" : "text-t2"
                    } ${m.id.startsWith("tmp-") ? "opacity-60" : ""}`}
                  >
                    {m.content}
                  </p>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
