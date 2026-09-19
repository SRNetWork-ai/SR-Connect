"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { FORCE_REDUCE_MOTION } from "@/lib/config";

/**
 * ظاهر شدن نرم عناصر.
 * اگر کاربر «کاهش انیمیشن» را روشن کرده باشد، محتوا بی‌هیچ انیمیشنی و
 * بی‌درنگ نمایش داده می‌شود (هیچ‌وقت opacity:0 گیر نمی‌کند).
 */
export function Reveal({
  children,
  className,
  y = 8,
  scale,
  delay = 0,
  duration = 0.3,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  scale?: number;
  delay?: number;
  duration?: number;
}) {
  const reduce = useReducedMotion() || FORCE_REDUCE_MOTION;
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y, scale: scale ?? 1 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** باز/بسته شدن ارتفاع‌دار — با کاهش انیمیشن به نمایش/عدم‌نمایش ساده تبدیل می‌شود. */
export function Collapse({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion() || FORCE_REDUCE_MOTION;

  if (reduce) return open ? <div className={className}>{children}</div> : null;

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className={`overflow-hidden ${className ?? ""}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
