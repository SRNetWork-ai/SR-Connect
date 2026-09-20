import { cn } from "@/lib/cn";

/** اسکلت بارگذاری با درخشش افقی. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("relative block overflow-hidden rounded-[6px] bg-[#3a3c42]", className)}
    >
      <span className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/8 to-transparent" />
    </span>
  );
}

export function MessageSkeleton() {
  return (
    <div className="flex gap-3 px-4 py-2">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2 py-1">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </div>
  );
}
