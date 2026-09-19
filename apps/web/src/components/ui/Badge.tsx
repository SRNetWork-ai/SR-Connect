import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "outline";

const TONES: Record<Tone, string> = {
  neutral: "bg-deep text-t3",
  brand: "bg-brand text-white",
  success: "bg-success-soft text-[#4ade80]",
  warning: "bg-warning-soft text-[#f5c451]",
  danger: "bg-danger-soft text-[#ff8a8d]",
  outline: "border border-stroke text-t4",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-xs font-bold",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
