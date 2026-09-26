"use client";

import { useEffect, useRef } from "react";
import { runUpdateFlow } from "@/lib/updater/run";
import { fetchManifest } from "@/lib/updater/client";
import { decide } from "@/lib/updater/decide";
import { relaunch } from "@/lib/updater/install";
import { autoUpdateEnabled } from "@/lib/updater/prefs";
import { fa } from "@/lib/fmt";
import { useApp } from "@/store/use-app";
import { useVoice } from "@/store/use-voice";

/** بررسی دوره‌ای بعد از ورود؛ اسپلش فقط یک‌بار و در ریشه اجرا می‌شود. */
const POLL_MS = 5 * 60 * 1000;

/**
 * به‌روزرسانی خودکار بعد از ورود به اپ.
 *
 * چرا لازم است: جریان اسپلش فقط وقتی اجرا می‌شود که کاربر از «/» وارد شود.
 * هر کس مستقیم `/app` را باز کند یا بعد از ورود به اپ برسد، هیچ‌وقت بررسی
 * نمی‌شد. این مؤلفه همان موتور تصمیم را در پس‌زمینه اجرا می‌کند.
 *
 * وسط تماس صوتی هیچ نصبی انجام نمی‌شود؛ decide خودش تصمیم را «تعویق» می‌کند.
 */
export function UpdateWatcher() {
  const inCall = useVoice((s) => s.status === "connected");
  const pushToast = useApp((s) => s.pushToast);
  const busy = useRef(false);
  const installed = useRef(false);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    const tick = async () => {
      if (!alive || busy.current || installed.current) return;
      if (!autoUpdateEnabled()) return;
      busy.current = true;
      try {
        const manifest = await fetchManifest(controller.signal);
        const decision = decide({ manifest, inCall });
        if (decision.kind !== "optional" && decision.kind !== "mandatory") return;

        const result = await runUpdateFlow({
          signal: controller.signal,
          inCall,
          onState: () => {},
        });
        if (!alive) return;
        if (result.phase === "ready" || result.phase === "blocked") {
          const target = "target" in result.decision! ? result.decision.target : manifest.latest;
          installed.current = true;
          pushToast(`نسخه ${fa(target)} نصب شد؛ در حال راه‌اندازی دوباره…`, "success");
          setTimeout(() => void relaunch(), 1_200);
        }
      } catch {
        /* آفلاین یا سرور آپدیت در دسترس نیست — اپ باید عادی کار کند. */
      } finally {
        busy.current = false;
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [inCall, pushToast]);

  return null;
}
