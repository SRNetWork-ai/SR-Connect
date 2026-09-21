"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { popIn } from "@/lib/motion";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** خط جداکننده بالای این آیتم. */
  separated?: boolean;
  hint?: string;
}

/**
 * منوی کشویی سبک و بدون وابستگی.
 * با کلیک بیرون، Escape و انتخاب آیتم بسته می‌شود؛ فوکوس هم مدیریت می‌شود.
 */
export function Menu({
  trigger,
  items,
  align = "start",
  className,
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
  className?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} className={cn("relative", className)}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label={label}
            variants={popIn}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ transformOrigin: "top" }}
            className={cn(
              "surface absolute top-full z-50 mt-1 min-w-[208px] rounded-lg p-1.5",
              align === "start" ? "start-0" : "end-0",
            )}
          >
            {items.map((item, i) => (
              <div key={item.label}>
                {item.separated && i > 0 && <span className="my-1 block h-px bg-divider" />}
                <button
                  role="menuitem"
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect?.();
                  }}
                  className={cn(
                    "press flex w-full items-center gap-2.5 rounded-[5px] px-2 py-1.5 text-start text-sm transition-colors disabled:opacity-40",
                    item.danger
                      ? "text-[#ff8a8d] hover:bg-danger hover:text-white"
                      : "text-t2 hover:bg-brand hover:text-white",
                  )}
                >
                  {item.icon && <span className="grid size-4 place-items-center">{item.icon}</span>}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="text-2xs opacity-70">{item.hint}</span>}
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
