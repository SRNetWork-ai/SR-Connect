"use client";

import { Plus, Send, Smile } from "lucide-react";
import { useState } from "react";
import { LIMITS } from "@sr/protocol";
import { useApp } from "@/store/use-app";
import { fa } from "@/lib/fmt";

export function Composer() {
  const channelId = useApp((s) => s.activeChannelId);
  const channel = useApp((s) => s.channels.find((c) => c.id === s.activeChannelId));
  const sendMessage = useApp((s) => s.sendMessage);
  const sendTyping = useApp((s) => s.sendTyping);
  const typing = useApp((s) => (s.activeChannelId ? s.typing[s.activeChannelId] : undefined));
  const meId = useApp((s) => s.me?.id);
  const [value, setValue] = useState("");

  const others = Object.entries(typing ?? {})
    .filter(([id, v]) => id !== meId && v.expiresAt > Date.now())
    .map(([, v]) => v.displayName);

  async function submit() {
    if (!channelId || !value.trim()) return;
    const text = value;
    setValue("");
    await sendMessage(channelId, text);
  }

  return (
    <div className="px-4 pb-6">
      <div className="flex items-end gap-2 rounded-lg bg-card px-3 py-2.5">
        <button className="grid size-6 shrink-0 place-items-center rounded-full bg-t4 text-deep hover:bg-t3">
          <Plus className="size-4" />
        </button>
        <textarea
          rows={1}
          value={value}
          maxLength={LIMITS.messageLength}
          onChange={(e) => {
            setValue(e.target.value);
            if (channelId) sendTyping(channelId);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={channel ? `پیام در ${channel.name}` : "یک کانال انتخاب کن"}
          disabled={!channelId}
          className="max-h-40 flex-1 resize-none bg-transparent text-base text-t2 outline-none placeholder:text-t5"
        />
        <button className="grid size-6 shrink-0 place-items-center text-t4 hover:text-t2">
          <Smile className="size-5" />
        </button>
        <button
          onClick={() => void submit()}
          disabled={!value.trim()}
          className="grid size-6 shrink-0 place-items-center text-brand disabled:text-t5"
          title="ارسال"
        >
          <Send className="size-4" />
        </button>
      </div>
      <div className="flex h-4 items-center justify-between px-1 pt-1 text-2xs text-t4">
        <span>
          {others.length === 1
            ? `${others[0]} دارد می‌نویسد…`
            : others.length > 1
              ? `${fa(others.length)} نفر دارند می‌نویسند…`
              : ""}
        </span>
        {value.length > LIMITS.messageLength - 200 && (
          <span className="tnum">{fa(LIMITS.messageLength - value.length)}</span>
        )}
      </div>
    </div>
  );
}
