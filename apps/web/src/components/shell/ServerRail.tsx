"use client";

import { Download, MessageSquare, Settings, Shield } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { fa } from "@/lib/fmt";
import { Logo } from "@/components/ui/Logo";
import { useApp } from "@/store/use-app";

interface NavItem {
  href: string;
  label: string;
  icon: typeof MessageSquare;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: "/app", label: "گفت‌وگو", icon: MessageSquare, exact: true },
  { href: "/app/updates", label: "مرکز آپدیت", icon: Download },
  { href: "/app/settings", label: "تنظیمات و نقش‌ها", icon: Settings },
];

export function ServerRail() {
  const pathname = usePathname();
  const isAdmin = useApp((s) => Boolean(s.me?.isAdmin));
  const hasUpdate = useApp((s) => Boolean(s.versionHint));
  const online = useApp((s) => Object.values(s.presence).filter((p) => p !== "offline").length);

  return (
    <nav
      aria-label="بخش‌ها"
      className="flex w-[72px] shrink-0 flex-col items-center gap-2 bg-rail py-3"
    >
      <Link href="/" title="صفحه‌ی اسپلش">
        <Logo size={48} />
      </Link>
      <span className="my-1 h-0.5 w-8 rounded-full bg-[#35363c]" />

      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const badge = item.href === "/app/updates" && hasUpdate ? 1 : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative grid size-12 place-items-center transition-all duration-150",
              active
                ? "rounded-[14px] bg-brand text-white"
                : "rounded-[16px] bg-card text-t2 hover:rounded-[14px] hover:bg-brand hover:text-white",
            )}
          >
            <item.icon className="size-5" />
            {active && (
              <span className="absolute -end-4 h-10 w-1 rounded-full bg-white" aria-hidden />
            )}
            {badge > 0 && (
              <span className="absolute -bottom-0.5 -start-0.5 grid h-5 min-w-5 place-items-center rounded-pill border-[3px] border-rail bg-danger px-1 text-2xs font-bold text-white">
                {fa(badge)}
              </span>
            )}
          </Link>
        );
      })}

      <div className="mt-auto flex flex-col items-center gap-1">
        {isAdmin && (
          <span title="دسترسی مدیر" className="grid size-8 place-items-center text-warning">
            <Shield className="size-4" />
          </span>
        )}
        <span className="tnum text-2xs text-t5" title="کاربران آنلاین">
          {fa(online)}
        </span>
      </div>
    </nav>
  );
}
