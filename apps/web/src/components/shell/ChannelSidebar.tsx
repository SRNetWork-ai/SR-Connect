"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Hash, HeadphoneOff, Lock, MicOff, Radio, Volume2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Channel } from "@sr/protocol";
import { cn } from "@/lib/cn";
import { fa } from "@/lib/fmt";
import { Avatar } from "@/components/ui/Avatar";
import { Tooltip } from "@/components/ui/Tooltip";
import { UserPanel } from "@/components/shell/UserPanel";
import { VoiceStatus } from "@/components/shell/VoiceStatus";
import { useApp } from "@/store/use-app";
import { useVoice } from "@/store/use-voice";
import { SERVER_URL } from "@/lib/config";

export function ChannelSidebar() {
  const categories = useApp((s) => s.categories);
  const channels = useApp((s) => s.channels);
  const activeChannelId = useApp((s) => s.activeChannelId);
  const setActiveChannel = useApp((s) => s.setActiveChannel);
  const stats = useApp((s) => s.stats);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const ordered = [...categories].sort((a, b) => a.position - b.position);
    const uncategorised = channels.filter((c) => !c.categoryId);
    return [
      ...ordered.map((cat) => ({
        id: cat.id,
        name: cat.name,
        items: channels
          .filter((c) => c.categoryId === cat.id)
          .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
      })),
      ...(uncategorised.length ? [{ id: "__none", name: "بدون دسته", items: uncategorised }] : []),
    ].filter((g) => g.items.length > 0);
  }, [categories, channels]);

  const host = SERVER_URL ? SERVER_URL.replace(/^https?:\/\//, "") : "سرور خودی";

  return (
    <div className="flex w-[252px] shrink-0 flex-col bg-sidebar">
      {/* سرصفحه‌ی سرور */}
      <button className="group relative flex h-[50px] items-center justify-between overflow-hidden px-4 shadow-line transition-colors hover:bg-hover/50">
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-l from-brand/12 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="relative text-start">
          <span className="block text-base font-bold text-t1">سرور SR-Connect</span>
          <span className="block text-2xs text-t4" dir="ltr">
            {host}
          </span>
        </span>
        <ChevronDown className="relative size-4 text-t3 transition-transform group-hover:translate-y-0.5" />
      </button>

      <div className="scroll-y flex-1 px-2 pt-2">
        {groups.map((group) => {
          const isCollapsed = Boolean(collapsed[group.id]);
          return (
            <section key={group.id}>
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [group.id]: !c[group.id] }))}
                className="flex w-full items-center gap-1 px-2 pt-4 pb-1 text-xs font-bold text-t4 transition-colors hover:text-t2"
              >
                <motion.span
                  animate={{ rotate: isCollapsed ? -90 : 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <ChevronDown className="size-3" />
                </motion.span>
                <span className="uppercase">{group.name}</span>
              </button>

              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    key="items"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    {group.items.map((ch) => (
                      <ChannelRow
                        key={ch.id}
                        channel={ch}
                        active={ch.id === activeChannelId}
                        onSelect={() => setActiveChannel(ch.id)}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          );
        })}

        {groups.length === 0 && (
          <p className="px-2 pt-6 text-center text-sm text-t4">
            هنوز کانالی ساخته نشده. از بخش تنظیمات اولین کانال را بساز.
          </p>
        )}

        {stats && (
          <p className="tnum px-2 pt-5 pb-2 text-center text-2xs text-t5">
            {fa(stats.online)} آنلاین از {fa(stats.members)} عضو
          </p>
        )}
        <div className="h-2" />
      </div>

      <VoiceStatus />
      <UserPanel />
    </div>
  );
}

function ChannelRow({
  channel,
  active,
  onSelect,
}: {
  channel: Channel;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = channel.type === "text" ? Hash : channel.type === "stage" ? Radio : Volume2;
  const participants = useApp((s) => s.voice[channel.id] ?? []);
  const unread = useApp((s) => s.unread[channel.id]);
  const speaking = useVoice((s) => s.speaking);
  const join = useVoice((s) => s.join);
  const isVoice = channel.type !== "text";
  const hasUnread = !active && (unread?.unread ?? 0) > 0;
  const mentions = unread?.mentions ?? 0;

  return (
    <div>
      <motion.button
        whileTap={{ scale: 0.985 }}
        onClick={() => (isVoice ? void join(channel.id) : onSelect())}
        className={cn(
          "group relative flex h-[33px] w-full items-center gap-1.5 rounded-[5px] px-2 text-start transition-colors",
          active ? "bg-[#404249] text-t1" : "text-t4 hover:bg-hover hover:text-t2",
          hasUnread && !active && "text-t1",
        )}
      >
        {/* نشانگر خوانده‌نشده روی لبه */}
        {hasUnread && (
          <motion.span
            layoutId={`unread-${channel.id}`}
            className="absolute -start-2 top-1/2 h-2 w-1 -translate-y-1/2 rounded-e-full bg-t1"
          />
        )}
        {active && (
          <motion.span
            layoutId="channel-active"
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="absolute inset-0 -z-10 rounded-[5px] bg-[#404249]"
          />
        )}

        <Icon className={cn("size-[18px] shrink-0", hasUnread ? "text-t2" : "text-t4")} />
        <span className={cn("truncate text-base", hasUnread && "font-semibold")}>
          {channel.name}
        </span>
        {channel.isPrivate && <Lock className="size-3 shrink-0 opacity-70" />}

        <span className="ms-auto flex shrink-0 items-center gap-1">
          {mentions > 0 && (
            <motion.span
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 520, damping: 22 }}
              className="tnum grid h-4 min-w-4 place-items-center rounded-pill bg-danger px-1 text-[10px] font-bold text-white"
            >
              {fa(mentions > 99 ? "99+" : mentions)}
            </motion.span>
          )}
          {hasUnread && mentions === 0 && (
            <span className="tnum grid h-4 min-w-4 place-items-center rounded-pill bg-[#4f535c] px-1 text-[10px] font-bold text-t1">
              {fa(unread!.unread > 99 ? "99+" : unread!.unread)}
            </span>
          )}
          {isVoice && (
            <span className="tnum rounded-pill bg-deep px-1.5 text-2xs text-t5">
              {fa(participants.length)}/{fa(channel.userLimit)}
            </span>
          )}
        </span>
      </motion.button>

      <AnimatePresence initial={false}>
        {participants.map((p) => (
          <motion.div
            key={p.userId}
            layout
            initial={{ opacity: 0, x: -8, height: 0 }}
            animate={{ opacity: 1, x: 0, height: 30 }}
            exit={{ opacity: 0, x: -8, height: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="flex items-center gap-2 overflow-hidden rounded-[4px] ps-6 pe-2 text-sm text-t4 hover:bg-hover"
          >
            <Avatar
              name={p.displayName}
              color={p.avatarColor}
              size="xs"
              ring={speaking.includes(p.userId)}
            />
            <span className={cn("truncate", speaking.includes(p.userId) && "text-t2")}>
              {p.displayName}
            </span>
            <span className="ms-auto flex items-center gap-1">
              {p.streaming && (
                <Tooltip label="در حال اشتراک صفحه">
                  <span className="rounded-[3px] bg-danger px-1 text-2xs font-bold text-white">
                    پخش
                  </span>
                </Tooltip>
              )}
              {p.muted && <MicOff className="size-3.5 text-danger" />}
              {p.deafened && <HeadphoneOff className="size-3.5 text-danger" />}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
