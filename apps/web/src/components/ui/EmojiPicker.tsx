"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

/** مجموعه‌ی کوچک و دسته‌بندی‌شده — بدون دیتاست سنگین. */
const GROUPS: { id: string; label: string; items: string[] }[] = [
  {
    id: "smileys",
    label: "لبخندها",
    items:
      "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😋 😛 🤪 🤨 🧐 🤓 😎 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕".split(
        " ",
      ),
  },
  {
    id: "gestures",
    label: "دست‌ها",
    items:
      "👍 👎 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👋 🤚 🖐️ ✋ 🖖 👏 🙌 🫶 🤝 🙏 💪 🦾 ✍️ 💅".split(
        " ",
      ),
  },
  {
    id: "hearts",
    label: "قلب‌ها",
    items:
      "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 ✨ ⭐ 🌟 💫 🔥 💯 ⚡ 🎉 🎊 🏆 🥇 🎯".split(
        " ",
      ),
  },
  {
    id: "objects",
    label: "اشیا",
    items:
      "💻 🖥️ ⌨️ 🖱️ 🎧 🎤 🎮 📱 📷 🔋 💡 🔧 🔨 ⚙️ 🧩 📦 📁 📝 📌 📎 🔒 🔑 🚀 🛰️ ⏰ ☕ 🍕 🍔 🍿 🍩".split(
        " ",
      ),
  },
  {
    id: "nature",
    label: "طبیعت",
    items:
      "🐶 🐱 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🦆 🦉 🦄 🐝 🦋 🌸 🌼 🌵 🌲 🌊 🌈 ☀️ 🌙 ❄️ 🍀 🍁".split(
        " ",
      ),
  },
];

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "🔥", "👀"];

export function EmojiPicker({
  open,
  onClose,
  onPick,
  align = "end",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
  align?: "start" | "end";
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState(GROUPS[0]!.id);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const items = useMemo(() => {
    if (query.trim()) {
      const all = GROUPS.flatMap((g) => g.items);
      return all.slice(0, 120);
    }
    return GROUPS.find((g) => g.id === group)?.items ?? [];
  }, [group, query]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className={cn(
            "surface absolute bottom-full z-50 mb-2 w-[296px] rounded-xl p-2",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          <div className="mb-2 flex items-center gap-1.5 rounded-[6px] bg-deep px-2 py-1.5">
            <Search className="size-3.5 text-t4" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جست‌وجوی ایموجی"
              className="w-full bg-transparent text-sm outline-none placeholder:text-t5"
            />
          </div>

          <div className="scroll-y grid max-h-[192px] grid-cols-8 gap-0.5">
            {items.map((emoji, i) => (
              <motion.button
                key={`${emoji}-${i}`}
                type="button"
                whileHover={{ scale: 1.25 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                onClick={() => {
                  onPick(emoji);
                  onClose();
                }}
                className="grid h-8 place-items-center rounded-[6px] text-lg hover:bg-hover"
              >
                {emoji}
              </motion.button>
            ))}
          </div>

          {!query.trim() && (
            <div className="mt-2 flex justify-between border-t border-divider pt-1.5">
              {GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  title={g.label}
                  onClick={() => setGroup(g.id)}
                  className={cn(
                    "grid size-8 place-items-center rounded-[6px] text-base transition-colors",
                    group === g.id ? "bg-brand-soft" : "hover:bg-hover",
                  )}
                >
                  {g.items[0]}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
