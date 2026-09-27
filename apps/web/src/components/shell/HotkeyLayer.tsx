"use client";

import { useEffect } from "react";
import { isTypingTarget } from "@/lib/hotkeys";
import { useApp } from "@/store/use-app";
import { useShell } from "@/store/use-shell";
import { useVoice } from "@/store/use-voice";

/**
 * شنونده‌ی سراسری میان‌بُرها.
 *
 * چرا یک لایه‌ی واحد و نه شنونده در هر کامپوننت: ترتیب و اولویت باید یک‌جا
 * روشن باشد، وگرنه دو کامپوننت روی یک کلید می‌افتند و یکی «کار نمی‌کند».
 */
export function HotkeyLayer() {
  const setView = useShell((s) => s.setView);
  const openSwitcher = useShell((s) => s.openSwitcher);
  const closeSwitcher = useShell((s) => s.closeSwitcher);
  const switcherOpen = useShell((s) => s.switcher !== null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;

      // Esc همیشه کار می‌کند، حتی وسط تایپ.
      if (event.key === "Escape" && switcherOpen) {
        event.preventDefault();
        closeSwitcher();
        return;
      }

      if (mod && event.shiftKey && (event.key === "F" || event.key === "f")) {
        event.preventDefault();
        openSwitcher("messages");
        return;
      }
      if (mod && !event.shiftKey && (event.key === "k" || event.key === "K")) {
        event.preventDefault();
        openSwitcher("channels");
        return;
      }

      // بقیه فقط بیرون از فیلدهای متنی، تا تایپ کاربر خراب نشود.
      if (isTypingTarget(event.target)) return;

      if (mod && event.shiftKey && (event.key === "M" || event.key === "m")) {
        event.preventDefault();
        void useVoice.getState().toggleMute();
        return;
      }
      if (mod && event.shiftKey && (event.key === "D" || event.key === "d")) {
        event.preventDefault();
        void useVoice.getState().toggleDeafen();
        return;
      }
      if (mod && event.key === ",") {
        event.preventDefault();
        setView("accountSettings");
        return;
      }
      if (event.altKey && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        stepChannel(event.key === "ArrowDown" ? 1 : -1);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setView, openSwitcher, closeSwitcher, switcherOpen]);

  return null;
}

/** جابه‌جایی بین کانال‌های متنی به همان ترتیبی که در نوار کناری دیده می‌شوند. */
function stepChannel(delta: number) {
  const app = useApp.getState();
  const list = app.channels
    .filter((c) => c.type === "text")
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  if (list.length === 0) return;
  const index = list.findIndex((c) => c.id === app.activeChannelId);
  const next = list[(index + delta + list.length) % list.length];
  useShell.getState().setView("chat");
  app.setActiveChannel(next.id);
}
