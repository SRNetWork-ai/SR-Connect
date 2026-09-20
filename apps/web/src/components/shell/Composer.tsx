"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AtSign, Bold, Code2, Italic, Paperclip, Send, Smile, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { has, LIMITS } from "@sr/protocol";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { Tooltip } from "@/components/ui/Tooltip";
import { PendingFiles } from "@/components/shell/AttachmentGrid";
import { cn } from "@/lib/cn";
import { fa } from "@/lib/fmt";
import { useApp } from "@/store/use-app";

export function Composer() {
  const channelId = useApp((s) => s.activeChannelId);
  const channel = useApp((s) => s.channels.find((c) => c.id === s.activeChannelId));
  const sendMessage = useApp((s) => s.sendMessage);
  const sendTyping = useApp((s) => s.sendTyping);
  const typing = useApp((s) => (s.activeChannelId ? s.typing[s.activeChannelId] : undefined));
  const replyTarget = useApp((s) => s.replyTarget);
  const setReplyTarget = useApp((s) => s.setReplyTarget);
  const members = useApp((s) => s.members);
  const me = useApp((s) => s.me);
  const pushToast = useApp((s) => s.pushToast);

  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [picker, setPicker] = useState(false);
  const [mention, setMention] = useState<{ query: string; at: number } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canAttach = me ? me.isAdmin || has(me.permissions, "ATTACH_FILES") : false;
  const disabled = !channelId || channel?.type !== "text";

  const others = Object.entries(typing ?? {})
    .filter(([id, v]) => id !== me?.id && v.expiresAt > Date.now())
    .map(([, v]) => v.displayName);

  // ارتفاع خودکار
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  useEffect(() => {
    if (replyTarget) inputRef.current?.focus();
  }, [replyTarget]);

  const suggestions = mention
    ? members
        .filter((m) => {
          const qq = mention.query.toLowerCase();
          return (
            !qq || m.displayName.toLowerCase().includes(qq) || m.username.toLowerCase().includes(qq)
          );
        })
        .slice(0, 6)
    : [];

  function onChange(next: string) {
    setValue(next);
    if (channelId) sendTyping(channelId);
    const caret = inputRef.current?.selectionStart ?? next.length;
    const before = next.slice(0, caret);
    const m = /(?:^|\s)@([\p{L}\p{N}_.-]{0,24})$/u.exec(before);
    if (m) {
      setMention({ query: m[1] ?? "", at: caret - (m[1]?.length ?? 0) - 1 });
      setMentionIndex(0);
    } else setMention(null);
  }

  function applyMention(userId: string) {
    if (!mention) return;
    const caret = inputRef.current?.selectionStart ?? value.length;
    const next = `${value.slice(0, mention.at)}<@${userId}> ${value.slice(caret)}`;
    setValue(next);
    setMention(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  /** درج نشانه‌گذاری دور متن انتخاب‌شده. */
  function wrap(prefix: string, suffix = prefix) {
    const el = inputRef.current;
    if (!el) return;
    const [a, b] = [el.selectionStart, el.selectionEnd];
    const next = `${value.slice(0, a)}${prefix}${value.slice(a, b)}${suffix}${value.slice(b)}`;
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + prefix.length, b + prefix.length);
    });
  }

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const incoming = [...list];
    const room = LIMITS.attachmentsPerMessage - files.length;
    if (room <= 0) {
      pushToast(`حداکثر ${LIMITS.attachmentsPerMessage} فایل در هر پیام`, "error");
      return;
    }
    const tooBig = incoming.find((f) => f.size > LIMITS.attachmentBytes);
    if (tooBig) {
      pushToast(`«${tooBig.name}» بزرگ‌تر از حد مجاز است`, "error");
      return;
    }
    setFiles((f) => [...f, ...incoming.slice(0, room)]);
  }

  async function submit() {
    if (disabled || (!value.trim() && files.length === 0)) return;
    const text = value;
    const attach = files;
    setValue("");
    setFiles([]);
    setMention(null);
    await sendMessage(channelId!, text, attach);
  }

  return (
    <div className="relative px-4 pb-5">
      {/* نوار پاسخ */}
      <AnimatePresence>
        {replyTarget && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="flex items-center gap-2 rounded-t-lg border-b border-divider bg-deep px-3 py-1.5 text-xs text-t3"
          >
            <span className="text-t4">پاسخ به</span>
            <span className="font-semibold" style={{ color: replyTarget.author.avatarColor }}>
              {replyTarget.author.displayName}
            </span>
            <span className="truncate text-t4">{replyTarget.content.slice(0, 90)}</span>
            <button
              onClick={() => setReplyTarget(null)}
              className="ms-auto grid size-5 place-items-center rounded text-t4 hover:text-t1"
            >
              <X className="size-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* پیشنهاد منشن */}
      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="surface absolute bottom-full inset-x-4 z-40 mb-2 overflow-hidden rounded-lg p-1"
          >
            <p className="px-2 py-1 text-2xs font-bold text-t4">اعضا</p>
            {suggestions.map((m, i) => (
              <button
                key={m.id}
                onMouseEnter={() => setMentionIndex(i)}
                onClick={() => applyMention(m.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[5px] px-2 py-1.5 text-start text-sm",
                  i === mentionIndex ? "bg-brand text-white" : "text-t2 hover:bg-hover",
                )}
              >
                <span
                  className="grid size-6 place-items-center rounded-full text-2xs font-bold text-white"
                  style={{ background: m.avatarColor }}
                >
                  {m.displayName[0]}
                </span>
                <span className="truncate">{m.displayName}</span>
                <span className="ms-auto text-2xs opacity-60" dir="ltr">
                  @{m.username}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        animate={{
          boxShadow: focused
            ? "0 0 0 1px var(--color-brand), 0 8px 26px -10px rgba(88,101,242,.55)"
            : "0 0 0 1px rgba(255,255,255,.04)",
        }}
        transition={{ duration: 0.18 }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (canAttach) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-lg bg-card",
          replyTarget && "rounded-t-none",
          disabled && "opacity-60",
        )}
      >
        <AnimatePresence>
          {files.length > 0 && (
            <PendingFiles
              files={files}
              onRemove={(i) => setFiles((f) => f.filter((_, x) => x !== i))}
            />
          )}
        </AnimatePresence>

        <div className="flex items-end gap-1.5 px-3 py-2.5">
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Tooltip label={canAttach ? "پیوست فایل" : "اجازه‌ی پیوست نداری"}>
            <motion.button
              whileHover={{ rotate: 8, scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              disabled={!canAttach || disabled}
              onClick={() => fileRef.current?.click()}
              className="grid size-7 shrink-0 place-items-center rounded-full text-t3 hover:bg-hover hover:text-t1 disabled:opacity-40"
            >
              <Paperclip className="size-4.5" />
            </motion.button>
          </Tooltip>

          <textarea
            ref={inputRef}
            rows={1}
            value={value}
            maxLength={LIMITS.messageLength}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => onChange(e.target.value)}
            onPaste={(e) => {
              const pasted = [...e.clipboardData.files];
              if (pasted.length && canAttach) {
                e.preventDefault();
                addFiles(pasted);
              }
            }}
            onKeyDown={(e) => {
              if (suggestions.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionIndex((i) => (i + 1) % suggestions.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  applyMention(suggestions[mentionIndex]!.id);
                  return;
                }
                if (e.key === "Escape") {
                  setMention(null);
                  return;
                }
              }
              if (e.key === "Escape" && replyTarget) setReplyTarget(null);
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={
              disabled
                ? "این کانال متنی نیست"
                : channel
                  ? `پیام در ${channel.name}`
                  : "یک کانال انتخاب کن"
            }
            disabled={disabled}
            data-testid="composer"
            aria-label="نوشتن پیام"
            className="max-h-[220px] flex-1 resize-none bg-transparent py-0.5 text-base text-t2 outline-none placeholder:text-t5"
          />

          <div className="flex shrink-0 items-center gap-0.5">
            <Tooltip label="ضخیم (Ctrl+B)">
              <button
                onClick={() => wrap("**")}
                className="grid size-7 place-items-center rounded-[5px] text-t4 hover:bg-hover hover:text-t2"
              >
                <Bold className="size-4" />
              </button>
            </Tooltip>
            <Tooltip label="مورب">
              <button
                onClick={() => wrap("*")}
                className="grid size-7 place-items-center rounded-[5px] text-t4 hover:bg-hover hover:text-t2"
              >
                <Italic className="size-4" />
              </button>
            </Tooltip>
            <Tooltip label="بلوک کد">
              <button
                onClick={() => wrap("```\n", "\n```")}
                className="grid size-7 place-items-center rounded-[5px] text-t4 hover:bg-hover hover:text-t2"
              >
                <Code2 className="size-4" />
              </button>
            </Tooltip>
            <Tooltip label="منشن">
              <button
                onClick={() => {
                  setValue((v) => `${v}@`);
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
                className="grid size-7 place-items-center rounded-[5px] text-t4 hover:bg-hover hover:text-t2"
              >
                <AtSign className="size-4" />
              </button>
            </Tooltip>

            <span className="relative">
              <Tooltip label="ایموجی">
                <motion.button
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setPicker((v) => !v)}
                  className="grid size-7 place-items-center rounded-[5px] text-t4 hover:bg-hover hover:text-t2"
                >
                  <Smile className="size-5" />
                </motion.button>
              </Tooltip>
              <EmojiPicker
                open={picker}
                onClose={() => setPicker(false)}
                onPick={(emoji) => {
                  setValue((v) => v + emoji);
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
              />
            </span>

            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => void submit()}
              disabled={disabled || (!value.trim() && files.length === 0)}
              className="grid size-8 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-hover disabled:bg-transparent disabled:text-t5"
              title="ارسال"
            >
              <Send className="size-4 -scale-x-100" />
            </motion.button>
          </div>
        </div>
      </motion.div>

      <div className="flex h-5 items-center justify-between px-1 pt-1 text-2xs text-t4">
        <AnimatePresence mode="wait">
          {others.length > 0 && (
            <motion.span
              key={others.join()}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-1.5"
            >
              <span className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1 animate-typing-dot rounded-full bg-t3"
                    style={{ animationDelay: `${i * 0.16}s` }}
                  />
                ))}
              </span>
              {others.length === 1
                ? `${others[0]} دارد می‌نویسد…`
                : `${fa(others.length)} نفر دارند می‌نویسند…`}
            </motion.span>
          )}
        </AnimatePresence>
        {value.length > LIMITS.messageLength - 300 && (
          <span
            className={cn(
              "tnum ms-auto",
              value.length > LIMITS.messageLength - 50 && "text-danger",
            )}
          >
            {fa(LIMITS.messageLength - value.length)}
          </span>
        )}
      </div>
    </div>
  );
}
