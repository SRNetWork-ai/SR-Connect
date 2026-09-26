"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { ServerRail } from "@/components/shell/ServerRail";
import { ChannelSidebar } from "@/components/shell/ChannelSidebar";
import { ScreenShareView } from "@/components/shell/ScreenShareView";
import { UpdateBanner } from "@/components/shell/UpdateBanner";
import { Tooltip } from "@/components/ui/Tooltip";
import { useShell } from "@/store/use-shell";

/**
 * قاب اپ بر اساس نمای فعال.
 *
 * باگی که رفع می‌کند: قبلاً نوار سرور و لیست کانال‌ها همیشه رندر می‌شدند، پس
 * در نمای دایرکت دو نوار کناری کنار هم می‌افتاد و در تنظیمات هم لیست کانال‌ها
 * بی‌دلیل نصف صفحه را می‌گرفت.
 *
 *   • گفت‌وگو  → ریل سرور + کانال‌ها + محتوا
 *   • دایرکت   → ریل سرور + نوار دوستان (داخل خود نما)
 *   • تنظیمات و مرکز آپدیت → تمام‌صفحه، با بستن به‌وسیله‌ی Escape
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const view = useShell((s) => s.view);
  const setView = useShell((s) => s.setView);

  const fullscreen = view === "accountSettings" || view === "serverSettings" || view === "updates";

  // در نمای تمام‌صفحه، Escape به گفت‌وگو برمی‌گردد — همان عادتی که کاربر دارد.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setView("chat");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen, setView]);

  if (fullscreen) {
    return (
      <div className="relative flex h-dvh flex-col overflow-hidden bg-chat-deep">
        <Tooltip label="بستن (Esc)">
          <button
            onClick={() => setView("chat")}
            aria-label="بستن"
            className="absolute end-5 top-5 z-20 grid size-9 place-items-center rounded-full border border-stroke text-t3 transition-colors hover:bg-hover hover:text-t1"
          >
            <X className="size-4" />
          </button>
        </Tooltip>
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <ServerRail />
      {view === "chat" && <ChannelSidebar />}
      <main className="bg-chat-deep flex min-w-0 flex-1 flex-col">
        <UpdateBanner />
        <ScreenShareView />
        {children}
      </main>
    </div>
  );
}
