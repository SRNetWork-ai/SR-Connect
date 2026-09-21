"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, Hash, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage } from "@sr/protocol";
import { MessageItem } from "@/components/shell/MessageItem";
import { MessageSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { fa } from "@/lib/fmt";
import { springSoft } from "@/lib/motion";
import { useApp } from "@/store/use-app";

const day = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" });

/**
 * مرجع ثابت برای حالت «کانال خالی».
 * اگر سلکتور هر بار آرایه‌ی تازه بسازد، useSyncExternalStore بی‌نهایت رندر می‌کند
 * و کل اپ با خطای «Maximum update depth exceeded» سفید می‌شود.
 */
const EMPTY_MESSAGES: ChatMessage[] = [];

/** پیام‌های پشت‌سرهم از یک نفر در بازه‌ی ۵ دقیقه، فشرده نمایش داده می‌شوند. */
function isCompact(prev: ChatMessage | undefined, m: ChatMessage): boolean {
  if (!prev || prev.author.id !== m.author.id) return false;
  if (m.replyPreview) return false;
  if (prev.system !== m.system) return false;
  return new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;
}

export function MessageList() {
  const channelId = useApp((s) => s.activeChannelId);
  const messages = useApp((s) =>
    s.activeChannelId ? (s.messages[s.activeChannelId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES,
  );
  const hasMore = useApp((s) =>
    s.activeChannelId ? Boolean(s.hasMore[s.activeChannelId]) : false,
  );
  const loading = useApp((s) =>
    s.activeChannelId ? Boolean(s.loadingHistory[s.activeChannelId]) : false,
  );
  const loadHistory = useApp((s) => s.loadHistory);
  const markRead = useApp((s) => s.markRead);
  const channel = useApp((s) => s.channels.find((c) => c.id === s.activeChannelId));
  const members = useApp((s) => s.members);

  const names = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m.displayName])),
    [members],
  );

  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const stickToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    if (atBottom.current) stickToBottom();
  }, [messages.length, stickToBottom]);

  useEffect(() => {
    atBottom.current = true;
    setShowJump(false);
    stickToBottom();
  }, [channelId, stickToBottom]);

  const firstLoad = loading && messages.length === 0;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          const bottom = el.scrollHeight - el.scrollTop - el.clientHeight;
          atBottom.current = bottom < 80;
          setShowJump(bottom > 320);
          if (atBottom.current && channelId) markRead(channelId);
          if (el.scrollTop < 140 && hasMore && !loading && channelId) {
            void loadHistory(channelId, { older: true });
          }
        }}
        className="scroll-y absolute inset-0 pb-3"
      >
        {firstLoad && (
          <div className="space-y-1 pt-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <MessageSkeleton key={i} />
            ))}
          </div>
        )}

        {hasMore && !firstLoad && (
          <div className="flex justify-center py-3">
            <button
              onClick={() => channelId && void loadHistory(channelId, { older: true })}
              className="press flex items-center gap-1.5 rounded-pill bg-card px-3 py-1 text-xs text-t3 transition-colors hover:bg-hover"
            >
              {loading && <Loader2 className="size-3 animate-spin" />}
              پیام‌های قدیمی‌تر
            </button>
          </div>
        )}

        {/* سرآغاز کانال */}
        {!hasMore && !firstLoad && channel && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="px-4 pt-8 pb-5"
          >
            <span className="grid size-[68px] place-items-center rounded-full bg-gradient-to-br from-brand to-accent shadow-pop">
              <Hash className="size-9 text-white" />
            </span>
            <h2 className="mt-4 text-2xl font-bold text-t1">به {channel.name} خوش آمدی</h2>
            <p className="mt-1 text-sm text-t4">
              {channel.topic ?? `این ابتدای کانال ${channel.name} است.`}
            </p>
            <span className="mt-4 block h-px bg-gradient-to-l from-transparent via-divider to-transparent" />
          </motion.div>
        )}

        {messages.length === 0 && !loading && (
          <div className="grid h-full place-items-center text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
            >
              <Sparkles className="mx-auto size-7 text-brand" />
              <p className="mt-2 text-lg font-bold text-t2">اینجا خالی است</p>
              <p className="mt-1 text-sm text-t4">
                {channel ? `اولین پیام کانال ${channel.name} را بنویس.` : "یک کانال انتخاب کن."}
              </p>
            </motion.div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const newDay =
              !prev ||
              new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
            return (
              <motion.div
                key={m.id}
                layout="position"
                initial={m.pending ? { opacity: 0, y: 6 } : false}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBlock: 0 }}
                transition={springSoft}
              >
                {newDay && (
                  <div className="my-4 flex items-center gap-3 px-4">
                    <span className="h-px flex-1 bg-divider" />
                    <span className="rounded-pill border border-divider px-2 py-0.5 text-2xs text-t4">
                      {day.format(new Date(m.createdAt))}
                    </span>
                    <span className="h-px flex-1 bg-divider" />
                  </div>
                )}
                <MessageItem message={m} compact={!newDay && isCompact(prev, m)} names={names} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* برگشت به آخرین پیام */}
      <AnimatePresence>
        {showJump && (
          <motion.button
            initial={{ opacity: 0, y: 10, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            onClick={() => {
              stickToBottom("smooth");
              atBottom.current = true;
              if (channelId) markRead(channelId);
            }}
            className={cn(
              "surface absolute bottom-3 end-4 z-10 flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs text-t2",
            )}
          >
            <ArrowDown className="size-3.5" />
            <span className="tnum">
              جدیدترین‌ها {messages.length ? `· ${fa(messages.length)}` : ""}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
