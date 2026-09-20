"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Headphones, HeadphoneOff, LogOut, Mic, MicOff, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PresenceStatus } from "@sr/protocol";
import { Avatar } from "@/components/ui/Avatar";
import { Tooltip } from "@/components/ui/Tooltip";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useApp } from "@/store/use-app";
import { useVoice } from "@/store/use-voice";

const STATUSES: { id: PresenceStatus; label: string; dot: string; hint: string }[] = [
  { id: "online", label: "آنلاین", dot: "bg-success", hint: "در دسترس" },
  { id: "idle", label: "بی‌کار", dot: "bg-warning", hint: "پشت سیستم نیستم" },
  { id: "dnd", label: "مزاحم نشوید", dot: "bg-danger", hint: "اعلان‌ها خاموش" },
  { id: "offline", label: "نامرئی", dot: "bg-offline", hint: "آفلاین نشان داده می‌شوی" },
];

export function UserPanel() {
  const router = useRouter();
  const me = useApp((s) => s.me);
  const status = useApp((s) => (s.me ? (s.presence[s.me.id] ?? "online") : "offline"));
  const setPresence = useApp((s) => s.setPresence);
  const muted = useVoice((s) => s.muted);
  const deafened = useVoice((s) => s.deafened);
  const toggleMute = useVoice((s) => s.toggleMute);
  const toggleDeafen = useVoice((s) => s.toggleDeafen);
  const leave = useVoice((s) => s.leave);

  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menu]);

  async function signOut() {
    await leave();
    await api.post("/api/auth/logout").catch(() => {});
    router.replace("/login");
  }

  return (
    <div ref={ref} className="relative flex h-[52px] items-center gap-2 bg-deep px-2">
      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="surface absolute bottom-full inset-x-2 z-50 mb-2 rounded-lg p-1.5"
          >
            <div className="flex items-center gap-2 rounded-[6px] px-2 py-2">
              <Avatar
                name={me?.displayName ?? "مهمان"}
                color={me?.avatarColor ?? "#5865F2"}
                url={me?.avatarUrl}
                size="lg"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-t1">
                  {me?.displayName ?? "مهمان"}
                </span>
                <span className="block truncate text-2xs text-t4" dir="ltr">
                  @{me?.username ?? "guest"}
                </span>
              </span>
            </div>
            {me?.bio && <p className="px-2 pb-2 text-2xs text-t3">{me.bio}</p>}
            <div className="my-1 h-px bg-divider" />
            {STATUSES.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setPresence(s.id);
                  setMenu(false);
                }}
                className="flex w-full items-center gap-2 rounded-[5px] px-2 py-1.5 text-start text-sm text-t2 transition-colors hover:bg-hover"
              >
                <span className={cn("size-2.5 rounded-full", s.dot)} />
                <span className="flex-1">{s.label}</span>
                {status === s.id && <Check className="size-3.5 text-t3" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setMenu((v) => !v)}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-[5px] p-1 text-start transition-colors hover:bg-hover"
      >
        <Avatar
          name={me?.displayName ?? "مهمان"}
          color={me?.avatarColor ?? "#5865F2"}
          url={me?.avatarUrl}
          size="md"
          presence={status as PresenceStatus}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-t1">
            {me?.displayName ?? "مهمان"}
          </span>
          <span className="block truncate text-xs text-t4" dir="ltr">
            @{me?.username ?? "guest"}
          </span>
        </span>
      </button>

      <div className="flex shrink-0">
        <IconButton
          title={muted ? "روشن کردن میکروفون" : "بی‌صدا کردن"}
          onClick={() => void toggleMute()}
        >
          {muted ? <MicOff className="size-4 text-danger" /> : <Mic className="size-4" />}
        </IconButton>
        <IconButton title="هدست" onClick={() => void toggleDeafen()}>
          {deafened ? (
            <HeadphoneOff className="size-4 text-danger" />
          ) : (
            <Headphones className="size-4" />
          )}
        </IconButton>
        <Tooltip label="تنظیمات">
          <Link
            href="/app/settings"
            className="grid size-8 place-items-center rounded-[4px] text-t3 transition-colors hover:bg-hover hover:text-t1"
          >
            <motion.span
              whileHover={{ rotate: 45 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Settings className="size-4" />
            </motion.span>
          </Link>
        </Tooltip>
        <IconButton title="خروج از حساب" onClick={() => void signOut()}>
          <LogOut className="size-4" />
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
}) {
  return (
    <Tooltip label={title}>
      <motion.button
        whileTap={{ scale: 0.9 }}
        aria-label={title}
        onClick={onClick}
        className="grid size-8 place-items-center rounded-[4px] text-t3 transition-colors hover:bg-hover hover:text-t1"
      >
        {children}
      </motion.button>
    </Tooltip>
  );
}
