import { cn } from "@/lib/cn";

/** نوار پیشرفت. اگر value ندهی حالت indeterminate با شیمر نشان می‌دهد. */
export function Progress({
  value,
  tone = "brand",
  className,
  label,
}: {
  value?: number;
  tone?: "brand" | "success" | "danger" | "warning";
  className?: string;
  label?: string;
}) {
  const tones = {
    brand: "bg-brand",
    success: "bg-success",
    danger: "bg-danger",
    warning: "bg-warning",
  } as const;

  const pct = value === undefined ? undefined : Math.max(0, Math.min(1, value)) * 100;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct === undefined ? undefined : Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative h-1.5 w-full overflow-hidden rounded-pill bg-[#1e1f22]", className)}
    >
      {pct === undefined ? (
        <div className="absolute inset-0 overflow-hidden">
          <div className={cn("h-full w-1/3 animate-shimmer rounded-pill", tones[tone])} />
        </div>
      ) : (
        <div
          className={cn(
            "h-full rounded-pill transition-[width] duration-200 ease-out",
            tones[tone],
          )}
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  );
}
