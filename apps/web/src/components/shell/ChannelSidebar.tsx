"use client";

import { ChevronDown, Hash, HeadphoneOff, Lock, MicOff, Radio, Volume2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Channel } from "@sr/protocol";
import { cn } from "@/lib/cn";
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
      <div className="flex h-[50px] items-center justify-between px-4 shadow-line">
        <span>
          <span className="block text-base font-bold text-t1">سرور SR-Connect</span>
          <span className="block text-2xs text-t4" dir="ltr">
            {host}
          </span>
        </span>
        <ChevronDown className="size-4 text-t3" />
      </div>

      <div className="scroll-y flex-1 px-2 pt-2">
        {groups.map((group) => (
          <section key={group.id}>
            <button
              onClick={() => setCollapsed((c) => ({ ...c, [group.id]: !c[group.id] }))}
              className="flex w-full items-center gap-1 px-2 pt-4 pb-1 text-xs font-bold text-t4 hover:text-t2"
            >
              <ChevronDown
                className={cn("size-3 transition-transform", collapsed[group.id] && "-rotate-90")}
              />
              <span className="uppercase">{group.name}</span>
            </button>

            {!collapsed[group.id] &&
              group.items.map((ch) => (
                <ChannelRow
                  key={ch.id}
                  channel={ch}
                  active={ch.id === activeChannelId}
                  onSelect={() => setActiveChannel(ch.id)}
                />
              ))}
          </section>
        ))}
        {groups.length === 0 && (
          <p className="px-2 pt-6 text-center text-sm text-t4">
            هنوز کانالی ساخته نشده. از بخش تنظیمات اولین کانال را بساز.
          </p>
        )}
        <div className="h-4" />
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
  const speaking = useVoice((s) => s.speaking);
  const join = useVoice((s) => s.join);
  const isVoice = channel.type !== "text";

  return (
    <div>
      <button
        onClick={() => (isVoice ? void join(channel.id) : onSelect())}
        className={cn(
          "group relative flex h-[33px] w-full items-center gap-1.5 rounded-[4px] px-2 text-start transition-colors",
          active ? "bg-[#404249] text-t1" : "text-t4 hover:bg-hover hover:text-t2",
        )}
      >
        <Icon className="size-[18px] shrink-0 text-t4" />
        <span className="truncate text-base">{channel.name}</span>
        {channel.isPrivate && <Lock className="size-3 shrink-0 opacity-70" />}
        {isVoice && (
          <span className="tnum ms-auto shrink-0 rounded-pill bg-deep px-1.5 text-2xs text-t5">
            {participants.length}/{channel.userLimit}
          </span>
        )}
      </button>

      {participants.map((p) => (
        <div
          key={p.userId}
          className="flex h-[30px] items-center gap-2 rounded-[4px] ps-6 pe-2 text-sm text-t4 hover:bg-hover"
        >
          <span
            className={cn(
              "grid size-[22px] shrink-0 place-items-center rounded-full text-2xs font-bold text-white",
              speaking.includes(p.userId) && "ring-2 ring-success",
            )}
            style={{ background: p.avatarColor }}
          >
            {p.displayName.slice(0, 2)}
          </span>
          <span className={cn("truncate", speaking.includes(p.userId) && "text-t2")}>
            {p.displayName}
          </span>
          <span className="ms-auto flex items-center gap-1">
            {p.streaming && (
              <span className="rounded-[3px] bg-danger px-1 text-2xs font-bold text-white">پخش</span>
            )}
            {p.muted && <MicOff className="size-3.5 text-danger" />}
            {p.deafened && <HeadphoneOff className="size-3.5 text-danger" />}
          </span>
        </div>
      ))}
    </div>
  );
}
