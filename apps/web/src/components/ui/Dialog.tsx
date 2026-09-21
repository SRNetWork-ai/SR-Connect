"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { easeQuick, popIn } from "@/lib/motion";

/** دیالوگ مرکزی با پس‌زمینه‌ی تار؛ Escape و کلیک بیرون آن را می‌بندد. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={easeQuick}
        >
          <button
            aria-label="بستن"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[3px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            variants={popIn}
            initial="hidden"
            animate="show"
            exit="exit"
            className="surface-raised relative w-full max-w-[420px] rounded-xl p-5"
          >
            <button
              onClick={onClose}
              aria-label="بستن"
              className="press absolute end-3 top-3 grid size-7 place-items-center rounded-[6px] text-t4 hover:bg-hover hover:text-t1"
            >
              <X className="size-4" />
            </button>
            <h2 className="pe-8 text-lg font-bold text-t1">{title}</h2>
            {description && <p className="mt-1.5 text-sm leading-relaxed text-t3">{description}</p>}
            {children && <div className="mt-4">{children}</div>}
            {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
