"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, LogIn, RotateCcw } from "lucide-react";
import { useApp } from "@/store/use-app";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

/**
 * تا وقتی bootstrap نیامده چیزی از اپ نشان نمی‌دهیم.
 *
 * درس گرفته‌شده از باگ «روی صفحه‌ی انتقال گیر می‌کند»: هر خطایی «نشست نامعتبر»
 * نیست. ۴۰۱ یعنی واقعاً باید به صفحه‌ی ورود برگردیم؛ ۵۰۰ یا قطعی شبکه یعنی
 * سرور مشکل دارد و کاربر باید خطا را ببیند و دکمه‌ی تلاش دوباره داشته باشد.
 * ناوبری کلاینتی هم اگر تا مهلت مشخص انجام نشد، با ناوبری سخت جایگزین می‌شود
 * تا هیچ‌وقت یک اسپینر بی‌پایان نماند.
 */
const ROUTER_FALLBACK_MS = 1_200;
const WATCHDOG_MS = 15_000;
const LOGIN_PATH = "/login?next=/app";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ready = useApp((s) => s.ready);
  const error = useApp((s) => s.error);
  const errorStatus = useApp((s) => s.errorStatus);
  const bootstrap = useApp((s) => s.bootstrap);
  const teardown = useApp((s) => s.teardown);
  const [slow, setSlow] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    void bootstrap();
    return () => teardown();
  }, [bootstrap, teardown]);

  const unauthorized = errorStatus === 401;

  // فقط ۴۰۱ به صفحه‌ی ورود می‌رود؛ اگر روتر کلاینتی نرفت، ناوبری سخت انجام می‌شود.
  useEffect(() => {
    if (ready || !unauthorized) return;
    router.replace(LOGIN_PATH);
    const hard = setTimeout(() => {
      if (window.location.pathname.startsWith("/app")) window.location.replace(LOGIN_PATH);
    }, ROUTER_FALLBACK_MS);
    return () => clearTimeout(hard);
  }, [ready, unauthorized, router]);

  // اگر نه آماده شد و نه خطا داد، بعد از مهلت، راه خروج نشان می‌دهیم.
  useEffect(() => {
    if (ready || error) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), WATCHDOG_MS);
    return () => clearTimeout(timer);
  }, [ready, error]);

  const retry = useCallback(async () => {
    setRetrying(true);
    setSlow(false);
    await bootstrap({ force: true });
    setRetrying(false);
  }, [bootstrap]);

  if (ready) return <>{children}</>;

  const blocked = (error && !unauthorized) || slow;

  return (
    <div className="grid h-dvh place-items-center bg-floating p-6">
      <div className="flex w-full max-w-[380px] flex-col items-center gap-4 text-center">
        <Logo size={44} />

        {blocked ? (
          <>
            <AlertTriangle className="size-7 text-warning" />
            <h1 className="text-base font-black text-t1">اپ بالا نیامد</h1>
            <p className="text-sm leading-6 text-t4">{error ?? "سرور در زمان مناسب پاسخ نداد."}</p>
            <div className="mt-1 flex w-full gap-2">
              <Button block loading={retrying} onClick={() => void retry()}>
                <RotateCcw className="size-4" /> تلاش دوباره
              </Button>
              <Button block variant="neutral" onClick={() => window.location.replace(LOGIN_PATH)}>
                <LogIn className="size-4" /> صفحه‌ی ورود
              </Button>
            </div>
          </>
        ) : (
          <span className="flex items-center gap-2 text-sm text-t4">
            <Loader2 className="size-4 animate-spin" />
            {unauthorized
              ? "نشست معتبر نیست، در حال انتقال به ورود…"
              : "در حال آماده‌سازی فضای کاری…"}
          </span>
        )}
      </div>
    </div>
  );
}
