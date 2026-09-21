"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { Composer } from "@/components/shell/Composer";
import { MessageList } from "@/components/shell/MessageList";
import { TopBar } from "@/components/shell/TopBar";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { UpdateCenter } from "@/components/updates/UpdateCenter";
import { viewSwap } from "@/lib/motion";
import { useShell, viewFromPath, type ShellView } from "@/store/use-shell";

/**
 * هر سه نمای اصلی اپ در همین کامپوننت زندگی می‌کنند و جابه‌جایی‌شان
 * کلاینت‌ساید است — بدون رفت‌وبرگشت شبکه، پس فوری.
 */
export function ShellViews({ initial }: { initial: ShellView }) {
  const view = useShell((s) => s.view);

  // بارگذاری مستقیم /app/settings یا /app/updates باید همان نما را باز کند.
  useEffect(() => {
    useShell.setState({ view: initial });
  }, [initial]);

  // دکمه‌ی back/forward مرورگر
  useEffect(() => {
    const onPop = () => useShell.setState({ view: viewFromPath(window.location.pathname) });
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={view}
        variants={viewSwap}
        initial="hidden"
        animate="show"
        exit="exit"
        className="flex min-h-0 flex-1 flex-col"
      >
        {view === "chat" ? (
          <>
            <TopBar />
            <MessageList />
            <Composer />
          </>
        ) : view === "updates" ? (
          <UpdateCenter />
        ) : (
          <SettingsPanel />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
