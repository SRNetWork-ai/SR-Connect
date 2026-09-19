"use client";

import { Download, PhoneCall, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Collapse } from "@/components/ui/Reveal";
import { fa } from "@/lib/fmt";
import { fetchManifest } from "@/lib/updater/client";
import { decide } from "@/lib/updater/decide";
import { relaunch } from "@/lib/updater/install";
import type { UpdateDecision } from "@/lib/updater/types";
import { useVoice } from "@/store/use-voice";

/**
 * بررسی دوره‌ای در پس‌زمینه — همان موتور تصمیم اسپلش.
 * اگر کاربر وسط تماس باشد تصمیم «تعویق» می‌شود و بنر فقط اطلاع می‌دهد.
 */
const POLL_MS = 5 * 60 * 1000;

export function UpdateBanner() {
  const inCall = useVoice((s) => s.status === "connected");
  const [decision, setDecision] = useState<UpdateDecision | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const manifest = await fetchManifest();
        if (alive) setDecision(decide({ manifest, inCall }));
      } catch {
        /* آفلاین؟ بی‌خیال. بنر چیزی نشان نمی‌دهد. */
      }
    };

    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [inCall]);

  // فقط تصمیم‌هایی که برای کاربر پیام دارند به بنر می‌رسند.
  const banner =
    !dismissed &&
    decision &&
    (decision.kind === "optional" ||
      decision.kind === "mandatory" ||
      (decision.kind === "deferred" && decision.reason === "in-call"))
      ? decision
      : null;

  return (
    <Collapse open={Boolean(banner)}>
      {banner && (
        <div
            className={`flex items-center gap-3 px-4 py-2 text-sm ${
              banner.kind === "mandatory" ? "bg-danger" : "bg-brand"
            } text-white`}
          >
            {banner.kind === "deferred" ? (
              <PhoneCall className="size-4 shrink-0" />
            ) : (
              <Download className="size-4 shrink-0" />
            )}

            <p className="flex-1">
              {banner.kind === "deferred" ? (
                <>
                  نسخه <span className="tnum font-bold">{fa(banner.target)}</span> آماده است؛ بعد
                  از پایان تماس صوتی نصب می‌شود.
                </>
              ) : (
                <>
                  نسخه <span className="tnum font-bold">{fa(banner.target)}</span>{" "}
                  {banner.kind === "mandatory" ? "اجباری است" : "منتشر شد"}. با یک بازنشانی نصب
                  می‌شود.
                </>
              )}
            </p>

            {banner.kind !== "deferred" && (
              <Button
                size="sm"
                variant="neutral"
                className="bg-white/15 text-white hover:bg-white/25"
                onClick={() => void relaunch()}
              >
                بازنشانی و نصب
              </Button>
            )}

            {banner.kind !== "mandatory" && (
              <button
                onClick={() => setDismissed(true)}
                className="grid size-6 place-items-center rounded transition-colors hover:bg-white/20"
                title="بستن"
              >
                <X className="size-4" />
              </button>
            )}
        </div>
      )}
    </Collapse>
  );
}
