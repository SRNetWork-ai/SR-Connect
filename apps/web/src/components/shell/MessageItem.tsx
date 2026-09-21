"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Copy,
  CornerUpLeft,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Reply,
  SmilePlus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@sr/protocol";
import { has } from "@sr/protocol";
import { Avatar } from "@/components/ui/Avatar";
import { EmojiPicker, QUICK_REACTIONS } from "@/components/ui/EmojiPicker";
import { Tooltip } from "@/components/ui/Tooltip";
import { AttachmentGrid } from "@/components/shell/AttachmentGrid";
import { Markdown } from "@/lib/markdown";
import { cn } from "@/lib/cn";
import { fa } from "@/lib/fmt";
import { Menu } from "@/components/ui/Menu";
import { useApp } from "@/store/use-app";

const time = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" });
const full = new Intl.DateTimeFormat("fa-IR", { dateStyle: "full", timeStyle: "short" });

export function MessageItem({
  message,
  compact,
  names,
}: {
  message: ChatMessage;
  /** پیام پشت‌سرهم از همان نویسنده: آواتار و نام تکرار نمی‌شود. */
  compact: boolean;
  names: Record<string, string>;
}) {
  const me = useApp((s) => s.me);
  const editingId = useApp((s) => s.editingId);
  const setEditing = useApp((s) => s.setEditing);
  const setReplyTarget = useApp((s) => s.setReplyTarget);
  const editMessage = useApp((s) => s.editMessage);
  const deleteMessage = useApp((s) => s.deleteMessage);
  const toggleReaction = useApp((s) => s.toggleReaction);
  const pushToast = useApp((s) => s.pushToast);

  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const editing = editingId === message.id;
  const mine = me?.id === message.author.id;
  const canManage = me ? me.isAdmin || has(me.permissions, "MANAGE_MESSAGES") : false;
  const canReact = me ? me.isAdmin || has(me.permissions, "ADD_REACTION") : false;
  const mentionsMe = Boolean(me && message.content.includes(`<@${me.id}>`));
  const local = message.id.startsWith("tmp-");

  useEffect(() => {
    if (editing) {
      setDraft(message.content);
      requestAnimationFrame(() => {
        const el = editRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      });
    }
  }, [editing, message.content]);

  const reactions = message.reactions ?? [];

  return (
    <motion.div
      layout="position"
      initial={local ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: message.pending ? 0.62 : 1, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      data-testid="message"
      data-message-id={message.id}
      className={cn(
        "msg-row group relative mx-2 px-3 transition-colors",
        compact ? "py-1" : "mt-3.5 py-1 first:mt-0",
        mentionsMe &&
          "bg-[#5865f214] before:absolute before:inset-y-0 before:start-0 before:w-0.5 before:rounded-full before:bg-brand",
        message.failed && "bg-danger-soft/40",
      )}
    >
      {/* پاسخ به پیام دیگر */}
      {message.replyPreview && !compact && (
        <div className="mb-0.5 flex items-center gap-1.5 ps-[52px] text-xs text-t4">
          <CornerUpLeft className="size-3 shrink-0 -scale-x-100" />
          <span className="font-semibold" style={{ color: message.replyPreview.authorColor }}>
            {message.replyPreview.authorName}
          </span>
          <span className="truncate opacity-80">
            {message.replyPreview.deleted ? "پیام حذف شده" : message.replyPreview.excerpt}
          </span>
        </div>
      )}

      <div className="flex gap-3">
        <div className="w-10 shrink-0">
          {compact ? (
            <span className="mt-1 block text-center text-[10px] text-t5 opacity-0 transition-opacity group-hover:opacity-100 tnum">
              {time.format(new Date(message.createdAt))}
            </span>
          ) : (
            <Avatar
              name={message.author.displayName}
              color={message.author.avatarColor}
              url={message.author.avatarUrl}
              size="lg"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {!compact && (
            <div className="flex items-baseline gap-2">
              <span className="text-base font-semibold text-t1 hover:underline">
                {message.author.displayName}
              </span>
              <span
                className="tnum text-2xs text-t4"
                title={full.format(new Date(message.createdAt))}
              >
                {time.format(new Date(message.createdAt))}
              </span>
              {message.system && (
                <span className="rounded-[3px] bg-brand-soft px-1 text-[9px] font-bold text-brand">
                  سیستم
                </span>
              )}
            </div>
          )}

          {editing ? (
            <div className="my-1">
              <textarea
                ref={editRef}
                rows={Math.min(8, draft.split("\n").length)}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditing(null);
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void editMessage(message.channelId, message.id, draft);
                  }
                }}
                data-testid="edit-box"
                aria-label="ویرایش متن پیام"
                className="w-full resize-none rounded-lg bg-deep px-3 py-2 text-base text-t2 outline-none ring-1 ring-stroke focus:ring-brand"
              />
              <p className="mt-1 text-2xs text-t4">
                <button className="text-link hover:underline" onClick={() => setEditing(null)}>
                  انصراف
                </button>
                {" · "}
                <button
                  className="text-link hover:underline"
                  onClick={() => void editMessage(message.channelId, message.id, draft)}
                >
                  ذخیره
                </button>
                {" · Esc برای لغو، Enter برای ذخیره"}
              </p>
            </div>
          ) : (
            message.content && (
              <Markdown
                content={message.content}
                options={{ names, meId: me?.id }}
                className={cn(
                  "msg-body",
                  message.system ? "text-t4 italic" : "text-t2",
                  message.failed && "text-danger",
                )}
              />
            )
          )}

          {message.editedAt && !editing && (
            <span className="ms-1 align-middle text-[10px] text-t5">(ویرایش‌شده)</span>
          )}

          {message.attachments && message.attachments.length > 0 && (
            <AttachmentGrid items={message.attachments} />
          )}

          {/* ری‌اکشن‌ها */}
          {reactions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              <AnimatePresence initial={false}>
                {reactions.map((r) => (
                  <motion.button
                    key={r.emoji}
                    layout
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    whileTap={{ scale: 0.88 }}
                    transition={{ type: "spring", stiffness: 520, damping: 26 }}
                    disabled={!canReact}
                    data-testid="reaction"
                    aria-label={`واکنش ${r.emoji}`}
                    onClick={() => void toggleReaction(message.channelId, message.id, r.emoji)}
                    className={cn(
                      "flex h-6 items-center gap-1 rounded-[7px] border px-1.5 text-sm transition-colors",
                      r.me
                        ? "border-brand bg-brand-soft text-t1"
                        : "border-transparent bg-[#2b2d31] text-t3 hover:border-stroke",
                    )}
                  >
                    <span className="text-[13px] leading-none">{r.emoji}</span>
                    <span className="tnum text-2xs font-bold">{fa(r.count)}</span>
                  </motion.button>
                ))}
              </AnimatePresence>
              {canReact && (
                <button
                  onClick={() => setPicker(true)}
                  className="grid h-6 w-7 place-items-center rounded-[7px] bg-[#2b2d31] text-t4 opacity-0 transition-opacity group-hover:opacity-100 hover:text-t1"
                >
                  <SmilePlus className="size-3.5" />
                </button>
              )}
            </div>
          )}

          {message.pending && (
            <span className="mt-0.5 flex items-center gap-1 text-2xs text-t5">
              <Loader2 className="size-3 animate-spin" />
              در حال ارسال…
            </span>
          )}
          {message.failed && (
            <span className="mt-0.5 flex items-center gap-1 text-2xs text-danger">
              <AlertCircle className="size-3" />
              ارسال نشد
            </span>
          )}
        </div>
      </div>

      {/* نوار ابزار شناور */}
      {!editing && !local && (
        <div className="absolute -top-3.5 end-4 z-20 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <div className="surface relative flex items-center rounded-[7px] p-0.5">
            {canReact &&
              QUICK_REACTIONS.slice(0, 3).map((emoji) => (
                <motion.button
                  key={emoji}
                  whileHover={{ scale: 1.22 }}
                  whileTap={{ scale: 0.9 }}
                  data-testid="quick-react"
                  aria-label={`واکنش سریع ${emoji}`}
                  onClick={() => void toggleReaction(message.channelId, message.id, emoji)}
                  className="grid size-7 place-items-center rounded-[5px] text-base hover:bg-hover"
                >
                  {emoji}
                </motion.button>
              ))}
            {canReact && (
              <Tooltip label="ری‌اکشن">
                <button
                  onClick={() => setPicker((v) => !v)}
                  className="grid size-7 place-items-center rounded-[5px] text-t3 hover:bg-hover hover:text-t1"
                >
                  <SmilePlus className="size-4" />
                </button>
              </Tooltip>
            )}
            <Tooltip label="پاسخ">
              <button
                data-testid="msg-reply"
                aria-label="پاسخ"
                onClick={() => setReplyTarget(message)}
                className="grid size-7 place-items-center rounded-[5px] text-t3 hover:bg-hover hover:text-t1"
              >
                <Reply className="size-4" />
              </button>
            </Tooltip>
            {mine && (
              <Tooltip label="ویرایش">
                <button
                  data-testid="msg-edit"
                  aria-label="ویرایش پیام"
                  onClick={() => setEditing(message.id)}
                  className="grid size-7 place-items-center rounded-[5px] text-t3 hover:bg-hover hover:text-t1"
                >
                  <Pencil className="size-4" />
                </button>
              </Tooltip>
            )}
            {(mine || canManage) && (
              <Tooltip label="حذف">
                <button
                  data-testid="msg-delete"
                  aria-label="حذف پیام"
                  onClick={() => setMenu(true)}
                  className="grid size-7 place-items-center rounded-[5px] text-t3 hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              </Tooltip>
            )}
            {!mine && !canManage && (
              <Menu
                label="کارهای بیشتر روی پیام"
                align="end"
                items={[
                  {
                    label: "کپی متن پیام",
                    icon: <Copy className="size-4" />,
                    onSelect: () => void copyToClipboard(message.content, pushToast),
                  },
                  {
                    label: "کپی لینک پیام",
                    icon: <Link2 className="size-4" />,
                    onSelect: () =>
                      void copyToClipboard(
                        `${typeof window === "undefined" ? "" : window.location.origin}/app?m=${message.id}`,
                        pushToast,
                        "لینک پیام کپی شد",
                      ),
                  },
                  {
                    label: "پاسخ به این پیام",
                    icon: <Reply className="size-4" />,
                    separated: true,
                    onSelect: () => setReplyTarget(message),
                  },
                ]}
                trigger={({ open, toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    aria-expanded={open}
                    aria-haspopup="menu"
                    aria-label="کارهای بیشتر"
                    className="press grid size-7 place-items-center rounded-[5px] text-t3 hover:bg-hover hover:text-t1"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                )}
              />
            )}

            <div className="absolute end-0 bottom-full">
              <EmojiPicker
                open={picker}
                onClose={() => setPicker(false)}
                onPick={(emoji) => void toggleReaction(message.channelId, message.id, emoji)}
              />
            </div>
          </div>
        </div>
      )}

      {/* تأیید حذف */}
      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] grid place-items-center bg-black/60 p-4 backdrop-blur-[2px]"
            onClick={() => setMenu(false)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 6 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="surface w-[420px] max-w-full rounded-xl p-5"
            >
              <h3 className="text-lg font-bold text-t1">حذف پیام</h3>
              <p className="mt-1.5 text-sm text-t3">مطمئنی؟ این کار برگشت‌پذیر نیست.</p>
              <div className="mt-3 max-h-40 overflow-auto rounded-lg bg-chat p-3">
                <Markdown content={message.content || "(بدون متن)"} className="text-sm text-t3" />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setMenu(false)}
                  className="rounded-[4px] px-4 py-2 text-sm text-t2 hover:underline"
                >
                  انصراف
                </button>
                <button
                  data-testid="confirm-delete"
                  onClick={() => {
                    setMenu(false);
                    void deleteMessage(message.channelId, message.id);
                  }}
                  className="rounded-[4px] bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-[#d8353a]"
                >
                  حذف
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** کپی متن در کلیپ‌بورد با بازخورد. */
async function copyToClipboard(
  text: string,
  toast: (t: string, k?: "info" | "success" | "warning" | "error") => void,
  okMessage = "متن پیام کپی شد",
) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMessage, "success");
  } catch {
    toast("مرورگر اجازه‌ی کپی نداد", "warning");
  }
}
