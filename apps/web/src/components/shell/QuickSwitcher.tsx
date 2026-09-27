"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Hash, Loader2, MessageSquare, Radio, Search, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { faDate } from "@/lib/fmt";
import { useApp } from "@/store/use-app";
import { useShell } from "@/store/use-shell";
import { useVoice } from "@/store/use-voice";

interface Hit {
  id: string;
  channelId: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorColor: string;
}

/**
 * پرش سریع (Ctrl+K) و جست‌وجوی پیام (Ctrl+Shift+F) در یک پنجره.
 *
 * چرا یکی و نه دو پنجره: کاربر نمی‌داند دنبال «کانال» است یا «پیام»؛ فقط یک
 * چیز در ذهنش است. پس یک ورودی می‌گیریم و هر دو را نشان می‌دهیم.
 */
export function QuickSwitcher() {
  const mode = useShell((s) => s.switcher);
  const close = useShell((s) => s.closeSwitcher);
  const setView = useShell((s) => s.setView);
  const channels = useApp((s) => s.channels);
  const setActiveChannel = useApp((s) => s.setActiveChannel);
  const joinVoice = useVoice((s) => s.join);

  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = mode !== null;

  useEffect(() => {
    if (!open) return;
    setTerm("");
    setHits([]);
    setCursor(0);
    // فوکوس بعد از انیمیشن ورود، وگرنه مرورگر آن را می‌خورد.
    const t = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, [open, mode]);

  const matchedChannels = useMemo(() => {
    if (!open) return [];
    const needle = term.trim().replace(/^#/, "").toLowerCase();
    const list = [...channels].sort((a, b) => a.position - b.position);
    if (!needle) return list.slice(0, 8);
    return list.filter((c) => c.name.toLowerCase().includes(needle)).slice(0, 8);
  }, [channels, term, open]);

  // جست‌وجوی سرور با تأخیر؛ هر حرف یک درخواست نفرستد.
  useEffect(() => {
    if (!open) return;
    const needle = term.trim();
    if (needle.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<{ hits: Hit[] }>(`/api/search?q=${encodeURIComponent(needle)}`);
        setHits(res.hits);
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 260);
    return () => clearTimeout(timer);
  }, [term, open]);

  const rows = useMemo(
    () => [
      ...matchedChannels.map((c) => ({ kind: "channel" as const, channel: c })),
      ...hits.map((h) => ({ kind: "message" as const, hit: h })),
    ],
    [matchedChannels, hits],
  );

  useEffect(() => {
    if (cursor > rows.length - 1) setCursor(0);
  }, [rows.length, cursor]);

  function run(index: number) {
    const row = rows[index];
    if (!row) return;
    if (row.kind === "channel") {
      if (row.channel.type === "text") {
        setView("chat");
        setActiveChannel(row.channel.id);
      } else {
        void joinVoice(row.channel.id);
      }
    } else {
      setView("chat");
      setActiveChannel(row.hit.channelId);
    }
    close();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => (c + 1) % Math.max(rows.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => (c - 1 + rows.length) % Math.max(rows.length, 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(cursor);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[130] flex items-start justify-center p-4 pt-[12vh]"
        >
          <button
            aria-label="بستن"
            onClick={close}
            className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-[3px]"
          />

          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            role="dialog"
            aria-label="پرش سریع"
            className="float-3d sheen-top relative w-full max-w-[560px] overflow-hidden rounded-2xl"
          >
            <div className="flex items-center gap-2.5 px-4 py-3.5">
              <Search className="size-4 shrink-0 text-t4" />
              <input
                ref={inputRef}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="نام کانال، یا چند حرف از یک پیام…"
                className="min-w-0 flex-1 bg-transparent text-base text-t1 outline-none placeholder:text-t5"
              />
              {searching && <Loader2 className="size-4 shrink-0 animate-spin text-t4" />}
            </div>

            <div className="rule-soft" />

            <div className="scroll-y max-h-[52vh] p-2">
              {rows.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-t4">
                  {term.trim().length < 2
                    ? "برای جست‌وجوی پیام حداقل دو حرف بنویس."
                    : "چیزی پیدا نشد."}
                </p>
              )}

              {matchedChannels.length > 0 && (
                <p className="px-3 pt-1 pb-1.5 text-2xs font-bold text-t5">کانال‌ها</p>
              )}
              {rows.map((row, index) =>
                row.kind === "channel" ? (
                  <Row
                    key={`c-${row.channel.id}`}
                    active={index === cursor}
                    onHover={() => setCursor(index)}
                    onClick={() => run(index)}
                  >
                    <ChannelIcon type={row.channel.type} />
                    <span className="truncate text-base text-t2">{row.channel.name}</span>
                    <span className="ms-auto shrink-0 text-2xs text-t5">
                      {row.channel.type === "text" ? "باز کن" : "وصل شو"}
                    </span>
                  </Row>
                ) : (
                  <div key={`m-${row.hit.id}`}>
                    {index === matchedChannels.length && (
                      <p className="px-3 pt-3 pb-1.5 text-2xs font-bold text-t5">پیام‌ها</p>
                    )}
                    <Row
                      active={index === cursor}
                      onHover={() => setCursor(index)}
                      onClick={() => run(index)}
                    >
                      <MessageSquare className="size-4 shrink-0 text-t5" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="text-2xs font-bold"
                            style={{ color: row.hit.authorColor }}
                          >
                            {row.hit.authorName}
                          </span>
                          <span className="text-2xs text-t5">
                            #{channels.find((c) => c.id === row.hit.channelId)?.name ?? "کانال"}
                          </span>
                          <span className="tnum text-2xs text-t5">{faDate(row.hit.createdAt)}</span>
                        </span>
                        <span className="block truncate text-sm text-t3">{row.hit.content}</span>
                      </span>
                    </Row>
                  </div>
                ),
              )}
            </div>

            <div className="rule-soft" />
            <p className="flex items-center gap-3 px-4 py-2.5 text-2xs text-t5">
              <Key>↑↓</Key> انتخاب
              <Key>Enter</Key> برو
              <Key>Esc</Key> بستن
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({
  children,
  active,
  onClick,
  onHover,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  onHover: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2 text-start transition-colors",
        active ? "bg-brand/18 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.06)]" : "hover:bg-hover/60",
      )}
    >
      {children}
    </button>
  );
}

function ChannelIcon({ type }: { type: string }) {
  const Icon = type === "text" ? Hash : type === "stage" ? Radio : Volume2;
  return <Icon className="size-4 shrink-0 text-t5" />;
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="well-3d rounded-[5px] px-1.5 py-0.5 font-sans text-2xs text-t3">{children}</kbd>
  );
}
