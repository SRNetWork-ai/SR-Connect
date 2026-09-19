import { cn } from "@/lib/cn";

/** نشان SR-Connect — حرف‌نگار SR داخل یک مربع گرد با گرادیان برند. */
export function Logo({
  size = 40,
  className,
  glow = false,
}: {
  size?: number;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center font-bold text-white select-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        fontSize: size * 0.36,
        letterSpacing: "0.02em",
        background: "linear-gradient(145deg, #6b78ff 0%, #5865f2 48%, #3f49c9 100%)",
        boxShadow: glow
          ? `0 0 0 1px rgb(255 255 255 / 0.12), 0 ${size * 0.22}px ${size * 0.6}px rgb(88 101 242 / 0.38)`
          : "0 0 0 1px rgb(255 255 255 / 0.08)",
      }}
      aria-hidden
    >
      SR
    </div>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-bold tracking-tight text-t1", className)}>
      SR<span className="text-brand">-</span>Connect
    </span>
  );
}
