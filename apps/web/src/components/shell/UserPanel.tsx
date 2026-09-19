"use client";

import { Headphones, HeadphoneOff, LogOut, Mic, MicOff, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useApp } from "@/store/use-app";
import { useVoice } from "@/store/use-voice";

const STATUS_COLOR: Record<string, string> = {
  online: "bg-success",
  idle: "bg-warning",
  dnd: "bg-danger",
  offline: "bg-offline",
};

export function UserPanel() {
  const router = useRouter();
  const me = useApp((s) => s.me);
  const status = useApp((s) => (s.me ? (s.presence[s.me.id] ?? "online") : "offline"));
  const muted = useVoice((s) => s.muted);
  const deafened = useVoice((s) => s.deafened);
  const toggleMute = useVoice((s) => s.toggleMute);
  const toggleDeafen = useVoice((s) => s.toggleDeafen);
  const leave = useVoice((s) => s.leave);

  async function signOut() {
    await leave();
    await api.post("/api/auth/logout").catch(() => {});
    router.replace("/login");
  }

  return (
    <div className="flex h-[52px] items-center gap-2 bg-deep px-2">
      <div className="relative">
        <span
          className="grid size-8 place-items-center rounded-full text-xs font-bold text-white"
          style={{ background: me?.avatarColor ?? "#5865F2" }}
        >
          {me?.displayName?.[0] ?? "؟"}
        </span>
        <span
          className={cn(
            "absolute -bottom-px -start-px size-3 rounded-full border-[3px] border-deep",
            STATUS_COLOR[status] ?? "bg-offline",
          )}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-t1">{me?.displayName ?? "مهمان"}</div>
        <div className="truncate text-xs text-t4" dir="ltr">
          @{me?.username ?? "guest"}
        </div>
      </div>

      <div className="flex">
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
        <Link
          href="/app/settings"
          title="تنظیمات"
          className="grid size-8 place-items-center rounded-[4px] text-t3 transition-colors hover:bg-hover hover:text-t1"
        >
          <Settings className="size-4" />
        </Link>
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
    <button
      title={title}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-[4px] text-t3 transition-colors hover:bg-hover hover:text-t1"
    >
      {children}
    </button>
  );
}
