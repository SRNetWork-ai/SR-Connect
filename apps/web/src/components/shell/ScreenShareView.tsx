"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, Minimize2, MonitorPlay, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useVoice } from "@/store/use-voice";

/** نمایش استریم‌های دریافتی؛ بالای لیست پیام‌ها می‌نشیند. */
export function ScreenShareView() {
  const screens = useVoice((s) => s.screens);
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (screens.length === 0) {
      setExpanded(false);
      setHidden(false);
    }
  }, [screens.length]);

  if (screens.length === 0 || hidden) return null;

  return (
    <AnimatePresence>
      <motion.section
        key="screens"
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        className={cn(
          "shrink-0 overflow-hidden border-b border-divider bg-floating",
          expanded ? "max-h-[62vh]" : "max-h-[34vh]",
        )}
      >
        <header className="flex items-center gap-2 px-3 py-1.5 text-xs text-t3">
          <MonitorPlay className="size-3.5 text-danger" />
          <span className="font-bold text-t2">اشتراک صفحه</span>
          <span className="text-t4">{screens.map((s) => s.displayName).join("، ")}</span>
          <span className="ms-auto flex gap-1">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="grid size-6 place-items-center rounded text-t4 hover:bg-hover hover:text-t1"
              title={expanded ? "کوچک کردن" : "بزرگ کردن"}
            >
              {expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </button>
            <button
              onClick={() => setHidden(true)}
              className="grid size-6 place-items-center rounded text-t4 hover:bg-hover hover:text-t1"
              title="بستن"
            >
              <X className="size-3.5" />
            </button>
          </span>
        </header>
        <div
          className={cn("grid gap-2 px-3 pb-3", screens.length > 1 ? "grid-cols-2" : "grid-cols-1")}
        >
          {screens.map((s) => (
            <ScreenTile key={s.userId} stream={s.stream} name={s.displayName} tall={expanded} />
          ))}
        </div>
      </motion.section>
    </AnimatePresence>
  );
}

function ScreenTile({ stream, name, tall }: { stream: MediaStream; name: string; tall: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <motion.div
      layout
      className="relative overflow-hidden rounded-lg border border-white/6 bg-black"
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={false}
        className={cn("w-full object-contain", tall ? "max-h-[52vh]" : "max-h-[26vh]")}
      />
      <span className="absolute bottom-1.5 start-2 rounded-pill bg-black/65 px-2 py-0.5 text-2xs text-white">
        {name}
      </span>
    </motion.div>
  );
}
