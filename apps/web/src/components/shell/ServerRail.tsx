"use client";

import { motion } from "framer-motion";
import { Download, MessageSquare, Shield } from "lucide-react";
import { cn } from "@/lib/cn";
import { fa } from "@/lib/fmt";
import { springSnappy, tap } from "@/lib/motion";
import { Tooltip } from "@/components/ui/Tooltip";
import { useApp } from "@/store/use-app";
import { useShell, type ShellView } from "@/store/use-shell";

interface NavItem {
  view: ShellView;
  label: string;
  icon: typeof MessageSquare;
}

const NAV: NavItem[] = [
  { view: "chat", label: "گفت‌وگو", icon: MessageSquare },
  { view: "updates", label: "مرکز آپدیت", icon: Download },
];

export function ServerRail() {
  const view = useShell((s) => s.view);
  const setView = useShell((s) => s.setView);
  const isAdmin = useApp((s) => Boolean(s.me?.isAdmin));
  const hasUpdate = useApp((s) => Boolean(s.versionHint));
  const online = useApp((s) => Object.values(s.presence).filter((p) => p !== "offline").length);
  const unreadTotal = useApp((s) =>
    Object.values(s.unread).reduce((sum, u) => sum + (u?.unread ?? 0), 0),
  );

  return (
    <nav
      aria-label="بخش‌ها"
      className="bg-rail-deep flex w-[72px] shrink-0 flex-col items-center gap-2 py-3"
    >
      <Tooltip label="دوستان و پیام‌های خصوصی" side="end">
        <motion.button
          type="button"
          whileTap={tap}
          onClick={() => setView("friends")}
          aria-label="دوستان و پیام‌های خصوصی"
          className={cn(
            "grid size-12 place-items-center rounded-[16px] text-base font-black transition-colors",
            view === "friends" ? "bg-brand text-white" : "bg-card text-t2 hover:bg-brand",
          )}
        >
          SR
        </motion.button>
      </Tooltip>
      <span className="my-1 h-0.5 w-8 rounded-full bg-[#35363c]" />

      {NAV.map((item) => {
        const active = view === item.view;
        const badge =
          item.view === "updates" && hasUpdate
            ? 1
            : item.view === "chat" && !active
              ? unreadTotal
              : 0;
        return (
          <Tooltip key={item.view} label={item.label} side="end">
            <motion.button
              type="button"
              whileTap={tap}
              onClick={() => setView(item.view)}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              className={cn(
                "relative grid size-12 place-items-center transition-[background-color,color,border-radius] duration-150",
                active
                  ? "rounded-[14px] bg-brand text-white"
                  : "rounded-[16px] bg-card text-t2 hover:rounded-[14px] hover:bg-brand hover:text-white",
              )}
            >
              <item.icon className="size-5" />

              {/* نشانگر فعال با layoutId بین آیتم‌ها می‌سُرد، نه اینکه بپرد. */}
              {active && (
                <motion.span
                  layoutId="rail-indicator"
                  transition={springSnappy}
                  className="absolute -end-4 h-10 w-1 rounded-full bg-white"
                  aria-hidden
                />
              )}

              {badge > 0 && (
                <motion.span
                  key={badge}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={springSnappy}
                  className="absolute -bottom-0.5 -start-0.5 grid h-5 min-w-5 place-items-center rounded-pill border-[3px] border-rail bg-danger px-1 text-2xs font-bold text-white"
                >
                  {fa(badge > 99 ? 99 : badge)}
                </motion.span>
              )}
            </motion.button>
          </Tooltip>
        );
      })}

      <div className="mt-auto flex flex-col items-center gap-1">
        {isAdmin && (
          <Tooltip label="دسترسی مدیر" side="end">
            <span className="grid size-8 place-items-center text-warning">
              <Shield className="size-4" />
            </span>
          </Tooltip>
        )}
        <Tooltip label="کاربران آنلاین" side="end">
          <span className="tnum text-2xs text-t5">{fa(online)}</span>
        </Tooltip>
      </div>
    </nav>
  );
}
