"use client";

import { AlertTriangle, ArrowLeft, RotateCcw, ShieldAlert, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Aurora } from "@/components/ui/Aurora";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Logo, Wordmark } from "@/components/ui/Logo";
import { Progress } from "@/components/ui/Progress";
import { Collapse, Reveal } from "@/components/ui/Reveal";
import { ServerHealth } from "@/components/splash/ServerHealth";
import { StepRow } from "@/components/splash/StepRow";
import { APP_VERSION, UPDATE_CHANNEL } from "@/lib/config";
import { cn } from "@/lib/cn";
import { fa } from "@/lib/fmt";
import { PLATFORM_LABEL, detectPlatform, type Platform } from "@/lib/platform";
import { DECISION_LABEL, DEFER_REASON_LABEL, MANDATORY_REASON_LABEL } from "@/lib/updater/decide";
import { relaunch } from "@/lib/updater/install";
import { useUpdateFlow } from "@/lib/updater/use-update-flow";
import { api } from "@/lib/api";
import { useSession } from "@/store/use-session";

const CHANNEL_LABEL = { stable: "پایدار", beta: "بتا", nightly: "شبانه" } as const;

export function SplashScreen({ theatrical = false }: { theatrical?: boolean }) {
  const router = useRouter();
  const inCall = useSession((s) => s.inCall);
  // نشست واقعی از سرور پرسیده می‌شود، نه از حافظه‌ی محلی.
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    void api
      .get("/api/auth/me")
      .then(() => alive && setAuthed(true))
      .catch(() => alive && setAuthed(false));
    return () => {
      alive = false;
    };
  }, []);

  // تشخیص بستر فقط بعد از mount؛ روی سرور navigator نداریم و hydration mismatch می‌دهد.
  const [platform, setPlatform] = useState<Platform | null>(null);
  useEffect(() => setPlatform(detectPlatform()), []);

  const flow = useUpdateFlow({ inCall, theatrical });
  const { steps, phase, decision, manifest, canEnter, bootAttempts, error } = flow;

  const progress = useMemo(() => {
    const weight = steps.reduce((acc, s) => {
      if (s.status === "done" || s.status === "skipped") return acc + 1;
      if (s.status === "active") return acc + (s.progress ?? 0.35);
      return acc;
    }, 0);
    return weight / steps.length;
  }, [steps]);

  const destination = authed ? "/app" : "/login";

  // ورود خودکار به اپ وقتی جریان تمام شد — همان رفتاری که کاربر انتظار دارد.
  useEffect(() => {
    if (!canEnter || authed === null) return;
    const t = setTimeout(() => router.replace(destination), theatrical ? 1400 : 650);
    return () => clearTimeout(t);
  }, [canEnter, authed, destination, router, theatrical]);

  const target = decision && "target" in decision ? decision.target : undefined;

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-floating p-6">
      <Aurora />

      <Reveal
        y={10}
        scale={0.97}
        duration={0.4}
        className="glass relative w-full max-w-[560px] overflow-hidden rounded-2xl shadow-float"
      >
        {/* نوار پنجره — برای بیلد دسکتاپ */}
        <div className="flex h-9 items-center gap-1.5 border-b border-white/5 px-4">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="ms-auto text-2xs text-t5">
            {platform ? PLATFORM_LABEL[platform] : ""}
          </span>
        </div>

        <div className="px-7 pt-7 pb-6">
          {/* سرلوحه */}
          <header className="flex items-center gap-4">
            <Logo size={56} glow />
            <div className="flex-1">
              <Wordmark className="text-xl" />
              <p className="mt-0.5 text-sm text-t4">در حال آماده‌سازی اتصال به سرور خودی…</p>
            </div>
            <div className="text-end">
              <div className="tnum text-sm font-semibold text-t2">{fa(APP_VERSION)}</div>
              <div className="text-2xs text-t5">کانال {CHANNEL_LABEL[UPDATE_CHANNEL]}</div>
            </div>
          </header>

          {/* نسخه‌ی مبدأ ← مقصد */}
          <Collapse open={Boolean(target && target !== APP_VERSION)} className="mt-5">
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2",
                decision?.kind === "mandatory"
                  ? "bg-danger-soft"
                  : decision?.kind === "rollback"
                    ? "bg-warning-soft"
                    : "bg-brand-soft",
              )}
            >
              <Badge
                tone={
                  decision?.kind === "mandatory"
                    ? "danger"
                    : decision?.kind === "rollback"
                      ? "warning"
                      : "brand"
                }
              >
                {decision ? DECISION_LABEL[decision.kind] : ""}
              </Badge>
              <span className="tnum text-sm text-t2">
                {fa(APP_VERSION)}
                <ArrowLeft className="mx-1.5 inline size-3.5 text-t4" />
                <span className="font-semibold text-t1">{fa(target ?? "")}</span>
              </span>
            </div>
          </Collapse>

          {/* مراحل */}
          <ul className="mt-5 divide-y divide-white/5">
            {steps.map((s, i) => (
              <StepRow key={s.id} step={s} index={i} />
            ))}
          </ul>

          {/* پیشرفت کلی */}
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-t4">
                {phase === "running" && "در حال اجرا"}
                {phase === "ready" && (authed ? "ورود به اپ…" : "انتقال به صفحه‌ی ورود…")}
                {phase === "blocked" && "ورود بسته است"}
                {phase === "failed" && "خطا"}
              </span>
              <span className="tnum text-t5">{fa(Math.round(progress * 100))}٪</span>
            </div>
            <Progress
              value={progress}
              tone={
                phase === "blocked" || phase === "failed"
                  ? "danger"
                  : phase === "ready"
                    ? "success"
                    : "brand"
              }
            />
          </div>

          {/* وضعیت سرور */}
          <div className="mt-5">
            <ServerHealth manifest={manifest} />
          </div>

          {/* پیام‌های حالت‌دار */}
          <div className="mt-4 space-y-2">
            {bootAttempts >= 1 && (
              <Notice tone="warning" icon={<AlertTriangle className="size-4" />}>
                بوت قبلی کامل نشد ({fa(bootAttempts)} بار). اگر یک بار دیگر تکرار شود، خودکار به
                نسخه‌ی سالم قبلی برمی‌گردیم.
              </Notice>
            )}

            {decision?.kind === "offline" && (
              <Notice tone="warning" icon={<WifiOff className="size-4" />}>
                {decision.error}. اپ با نسخه‌ی{" "}
                <span className="tnum">{fa(decision.cachedVersion)}</span> باز می‌شود و بررسی نسخه
                در پس‌زمینه تکرار می‌شود.
              </Notice>
            )}

            {decision?.kind === "deferred" && (
              <Notice tone="neutral">{DEFER_REASON_LABEL[decision.reason]}</Notice>
            )}

            {decision?.kind === "mandatory" && (
              <Notice tone="danger" icon={<ShieldAlert className="size-4" />}>
                {MANDATORY_REASON_LABEL[decision.reason]}
              </Notice>
            )}

            {decision?.kind === "rollback" && (
              <Notice tone="warning" icon={<RotateCcw className="size-4" />}>
                بعد از {fa(decision.crashes)} کرش پشت‌سرهم، بازگشت به نسخه‌ی{" "}
                <span className="tnum">{fa(decision.target)}</span>.
              </Notice>
            )}

            {error && phase !== "ready" && (
              <Notice tone="danger" icon={<AlertTriangle className="size-4" />}>
                {error}
              </Notice>
            )}
          </div>

          {/* اکشن‌ها */}
          <footer className="mt-5 flex items-center gap-2">
            {phase === "blocked" || phase === "failed" ? (
              <>
                <Button variant="brand" onClick={() => void flow.retry()}>
                  تلاش مجدد
                </Button>
                <Button variant="ghost" onClick={() => void relaunch()}>
                  بازنشانی اپ
                </Button>
              </>
            ) : (
              <Button
                variant={canEnter ? "success" : "neutral"}
                loading={!canEnter}
                onClick={() => router.replace(destination)}
              >
                {canEnter ? "ورود به اپ" : "کمی صبر کنید"}
              </Button>
            )}

            <span className="ms-auto text-2xs text-t5">
              بررسی نسخه حداکثر ۲ ثانیه؛ بعد از آن اپ بدون معطلی باز می‌شود
            </span>
          </footer>
        </div>
      </Reveal>
    </main>
  );
}

function Notice({
  tone,
  icon,
  children,
}: {
  tone: "neutral" | "warning" | "danger";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-xs leading-relaxed",
        tone === "neutral" && "bg-white/5 text-t3",
        tone === "warning" && "bg-warning-soft text-[#f5c451]",
        tone === "danger" && "bg-danger-soft text-[#ff8a8d]",
      )}
    >
      {icon && <span className="mt-px shrink-0">{icon}</span>}
      <p>{children}</p>
    </div>
  );
}
