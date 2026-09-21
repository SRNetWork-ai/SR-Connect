"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { useApp } from "@/store/use-app";

const TONE = {
  info: { icon: Info, cls: "text-link" },
  success: { icon: CheckCircle2, cls: "text-success" },
  warning: { icon: AlertTriangle, cls: "text-warning" },
  error: { icon: XCircle, cls: "text-danger" },
} as const;

/** نوتیفیکیشن‌های کوتاه گوشه‌ی صفحه. */
export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed bottom-4 end-4 z-[100] flex w-[320px] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const { icon: Icon, cls } = TONE[t.kind];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 24, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="surface pointer-events-auto flex items-start gap-2.5 rounded-lg px-3 py-2.5"
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", cls)} />
              <p className="flex-1 text-sm text-t2">{t.text}</p>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="بستن"
                className="press grid size-5 place-items-center rounded text-t4 hover:bg-hover hover:text-t1"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
