"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useApp } from "@/store/use-app";
import { Logo } from "@/components/ui/Logo";

/**
 * تا وقتی bootstrap نیامده چیزی از اپ نشان نمی‌دهیم؛
 * ۴۰۱ یعنی کوکی نشست منقضی شده و باید به صفحه‌ی ورود برگردیم.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ready = useApp((s) => s.ready);
  const error = useApp((s) => s.error);
  const bootstrap = useApp((s) => s.bootstrap);
  const teardown = useApp((s) => s.teardown);

  useEffect(() => {
    void bootstrap();
    return () => teardown();
  }, [bootstrap, teardown]);

  useEffect(() => {
    if (!ready && error) {
      const t = setTimeout(() => router.replace("/login?next=/app"), 400);
      return () => clearTimeout(t);
    }
  }, [ready, error, router]);

  if (!ready) {
    return (
      <div className="grid h-dvh place-items-center bg-floating">
        <div className="flex flex-col items-center gap-4">
          <Logo size={44} />
          <span className="flex items-center gap-2 text-sm text-t4">
            <Loader2 className="size-4 animate-spin" />
            {error ? "نشست معتبر نیست، در حال انتقال به ورود…" : "در حال آماده‌سازی فضای کاری…"}
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
