"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export type Presence = "online" | "idle" | "dnd" | "offline";

const DOT: Record<Presence, string> = {
  online: "bg-success",
  idle: "bg-warning",
  dnd: "bg-danger",
  offline: "bg-offline",
};

const SIZES = {
  xs: "size-[22px] text-[10px]",
  sm: "size-7 text-2xs",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
  xl: "size-20 text-2xl",
} as const;

/** دو حرف اول نام؛ برای فارسی هم درست کار می‌کند. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`;
  return (parts[0] ?? "؟").slice(0, 2);
}

export function Avatar({
  name,
  color,
  url,
  size = "md",
  presence,
  ring,
  ringColor = "var(--color-success)",
  className,
  onClick,
  title,
}: {
  name: string;
  color: string;
  url?: string | null;
  size?: keyof typeof SIZES;
  presence?: Presence;
  /** حلقه‌ی «در حال صحبت» */
  ring?: boolean;
  ringColor?: string;
  className?: string;
  onClick?: () => void;
  title?: string;
}) {
  const borderTone =
    size === "xs" || size === "sm" ? "border-2" : size === "xl" ? "border-4" : "border-[3px]";

  return (
    <span
      className={cn("relative inline-flex shrink-0", onClick && "cursor-pointer", className)}
      title={title}
    >
      <motion.span
        onClick={onClick}
        animate={
          ring
            ? { boxShadow: `0 0 0 2px ${ringColor}, 0 0 12px -1px ${ringColor}` }
            : { boxShadow: "0 0 0 0px transparent" }
        }
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
        className={cn(
          "grid place-items-center overflow-hidden rounded-full font-bold text-white select-none",
          SIZES[size],
        )}
        style={{ background: url ? "#1e1f22" : color }}
      >
        {url ? (
          // آواتار از همان دامنه سرو می‌شود، پس <img> ساده کافی است.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={name}
            className="size-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          initials(name)
        )}
      </motion.span>

      {presence && (
        <motion.span
          layout
          initial={false}
          animate={{ scale: 1 }}
          className={cn(
            "absolute -bottom-px -start-px rounded-full border-deep",
            size === "xl" ? "size-6" : size === "lg" ? "size-3.5" : "size-3",
            borderTone,
            DOT[presence],
          )}
        />
      )}
    </span>
  );
}
