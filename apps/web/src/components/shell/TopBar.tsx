"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bell, Hash, Radio, Search, Users, Volume2, Wifi, WifiOff } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import { fa } from "@/lib/fmt";
import { useApp } from "@/store/use-app";

const ORDER = { online: 0, dnd: 1, idle: 2, offline: 3 } as const;

export function TopBar() {
  const channel = useApp((s) => s.channels.find((c) => c.id === s.activeChannelId));
  const socketStatus = useApp((s) => s.socketStatus);
  const members = useApp((s) => s.members);
  const presence = useApp((s) => s.presence);
  const unread = useApp((s) => s.unread);
  const setActiveChannel = useApp((s) => s.setActiveChannel);
  const [showMembers, setShowMembers] = useState(false);
  const [query, setQuery] = useState("");

  const Icon = !channel
    ? Hash
    : channel.type === "text"
      ? Hash
      : channel.type === "stage"
        ? Radio
        : Volume2;

  const sorted = useMemo(() => {
    const qq = query.trim().toLowerCase();
    return [...members]
      .filter((m) => !qq || m.displayName.toLowerCase().includes(qq) || m.username.includes(qq))
      .sort((a, b) => {
        const sa = ORDER[(presence[a.id] ?? "offline") as keyof typeof ORDER];
        const sb = ORDER[(presence[b.id] ?? "offline") as keyof typeof ORDER];
        return sa - sb || a.displayName.localeCompare(b.displayName, "fa");
      });
  }, [members, presence, query]);

  const online = members.filter((m) => (presence[m.id] ?? "offline") !== "offline").length;
  const totalMentions = Object.values(unread).reduce((n, u) => n + u.mentions, 0);

  /** اولین کانالی که منشن خوانده‌نشده دارد را باز می‌کند. */
  function jumpToMention() {
    const target = Object.entries(unread).find(([, u]) => u.mentions > 0)?.[0];
    if (target) setActiveChannel(target);
  }

  return (
    <header className="bar-glass relative z-20 flex h-[50px] shrink-0 items-center gap-2.5 px-4 shadow-line">
      <motion.span
        key={channel?.id}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 480, damping: 24 }}
      >
        <Icon className="size-5 text-t4" />
      </motion.span>
      <h1 className="text-base font-bold text-t1">{channel?.name ?? "کانالی انتخاب نشده"}</h1>
      {channel?.topic && (
        <p className="ms-1 truncate border-s border-divider ps-2.5 text-sm text-t4">
          {channel.topic}
        </p>
      )}

      <div className="ms-auto flex shrink-0 items-center gap-1.5">
        <Tooltip label={socketStatus === "open" ? "اتصال زنده برقرار است" : "در حال اتصال مجدد"}>
          <span
            className={cn(
              "flex items-center gap-1 rounded-pill px-2 py-0.5 text-2xs transition-colors",
              socketStatus === "open"
                ? "bg-success-soft text-success"
                : "bg-warning-soft text-warning",
            )}
          >
            {socketStatus === "open" ? (
              <Wifi className="size-3" />
            ) : (
              <WifiOff className="size-3 animate-pulse" />
            )}
            {socketStatus === "open" ? "زنده" : "اتصال مجدد…"}
          </span>
        </Tooltip>

        {totalMentions > 0 && (
          <Tooltip label={`${fa(totalMentions)} منشن خوانده‌نشده — برای رفتن کلیک کن`}>
            <button
              type="button"
              onClick={jumpToMention}
              aria-label="رفتن به منشن خوانده‌نشده"
              className="relative grid size-8 place-items-center rounded-[4px] text-t3 hover:bg-hover hover:text-t1"
            >
              <Bell className="size-4" />
              <motion.span
                initial={{ scale: 0.4 }}
                animate={{ scale: 1 }}
                className="tnum absolute top-1 end-1 grid h-3.5 min-w-3.5 place-items-center rounded-pill bg-danger px-0.5 text-[9px] font-bold text-white"
              >
                {fa(totalMentions > 9 ? "9+" : totalMentions)}
              </motion.span>
            </button>
          </Tooltip>
        )}

        <Tooltip label="اعضا">
          <button
            onClick={() => setShowMembers((v) => !v)}
            className={cn(
              "flex h-8 items-center gap-1 rounded-[4px] px-2 text-t3 transition-colors hover:bg-hover hover:text-t1",
              showMembers && "bg-hover text-t1",
            )}
          >
            <Users className="size-4.5" />
            <span className="tnum text-xs">{fa(online)}</span>
          </button>
        </Tooltip>
      </div>

      <AnimatePresence>
        {showMembers && (
          <motion.aside
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="surface absolute end-2 top-[52px] z-30 flex max-h-[68vh] w-[260px] flex-col rounded-xl p-2"
          >
            <div className="mb-1.5 flex items-center gap-1.5 rounded-[6px] bg-deep px-2 py-1.5">
              <Search className="size-3.5 text-t4" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جست‌وجوی عضو"
                className="w-full bg-transparent text-sm outline-none placeholder:text-t5"
              />
            </div>
            <p className="px-2 pb-1 text-2xs font-bold text-t4">
              اعضا — {fa(online)} آنلاین از {fa(members.length)}
            </p>
            <div className="scroll-y flex-1">
              {sorted.map((m) => {
                const status = (presence[m.id] ?? "offline") as
                  "online" | "idle" | "dnd" | "offline";
                return (
                  <motion.div
                    key={m.id}
                    layout
                    className={cn(
                      "flex items-center gap-2 rounded-[5px] px-2 py-1 text-sm transition-colors hover:bg-hover",
                      status === "offline" ? "text-t5 opacity-60" : "text-t2",
                    )}
                  >
                    <Avatar
                      name={m.displayName}
                      color={m.avatarColor}
                      url={m.avatarUrl}
                      size="sm"
                      presence={status}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{m.displayName}</span>
                      {m.bio && <span className="block truncate text-2xs text-t5">{m.bio}</span>}
                    </span>
                    {m.isAdmin && (
                      <span className="rounded-[3px] bg-brand-soft px-1 text-[9px] font-bold text-brand">
                        ادمین
                      </span>
                    )}
                  </motion.div>
                );
              })}
              {sorted.length === 0 && (
                <p className="py-4 text-center text-xs text-t4">کسی پیدا نشد</p>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </header>
  );
}
