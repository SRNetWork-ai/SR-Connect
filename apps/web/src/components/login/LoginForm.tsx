"use client";

import { CheckCircle2, Loader2, ServerCrash } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { Reveal } from "@/components/ui/Reveal";
import { Logo, Wordmark } from "@/components/ui/Logo";
import { QrPanel } from "@/components/login/QrPanel";
import { api, ApiError } from "@/lib/api";
import { APP_VERSION, serverEndpoint } from "@/lib/config";
import { fa } from "@/lib/fmt";
import { useSession } from "@/store/use-session";

type Reach = "checking" | "online" | "offline";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const signIn = useSession((s) => s.signIn);
  const storedServer = useSession((s) => s.serverUrl);

  const [server, setServer] = useState(storedServer);
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ identity?: string; password?: string; form?: string }>({});
  const [reach, setReach] = useState<Reach>("checking");

  // آیا سرور خودی جواب می‌دهد؟ قبل از تلاش برای ورود بدانیم.
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2_000);

    fetch(serverEndpoint("/api/health"), { cache: "no-store", signal: ctrl.signal })
      .then((r) => alive && setReach(r.ok ? "online" : "offline"))
      .catch(() => alive && setReach("offline"))
      .finally(() => clearTimeout(timer));

    return () => {
      alive = false;
      ctrl.abort();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (identity.trim().length < 3) next.identity = "حداقل ۳ نویسه";
    if (password.length < 6) next.password = "حداقل ۶ نویسه";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const res = await api.post<{
        user: { id: string; username: string; displayName: string; avatarColor: string };
      }>("/api/auth/login", { identity: identity.trim(), password });

      signIn(
        {
          id: res.user.id,
          name: res.user.displayName,
          tag: "@" + res.user.username,
          color: res.user.avatarColor,
        },
        server.trim(),
        remember,
      );
      router.replace(params.get("next") || "/app");
    } catch (err) {
      setErrors({
        form:
          err instanceof ApiError
            ? err.message
            : "ارتباط با سرور برقرار نشد. آدرس سرور را بررسی کن.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Reveal
      y={12}
      duration={0.35}
      className="relative flex w-full max-w-[820px] gap-8 rounded-[6px] bg-sidebar p-8 shadow-float"
    >
      <div className="flex-1">
        <header className="text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <Logo size={40} glow />
            <Wordmark className="text-lg" />
          </div>
          <h1 className="text-2xl font-bold text-t1">خوش برگشتی!</h1>
          <p className="mt-1 text-base text-t3">به سرور خودت وصل شو</p>
        </header>

        <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
          <Field
            label="آدرس سرور"
            required
            dir="ltr"
            value={server}
            onChange={(e) => setServer(e.target.value)}
            placeholder="chat.example.com"
            className="text-start"
            status={
              reach === "checking" ? (
                <Badge tone="outline">
                  <Loader2 className="size-3 animate-spin" /> بررسی
                </Badge>
              ) : reach === "online" ? (
                <Badge tone="success">
                  <CheckCircle2 className="size-3" /> در دسترس
                </Badge>
              ) : (
                <Badge tone="danger">
                  <ServerCrash className="size-3" /> بی‌پاسخ
                </Badge>
              )
            }
            hint="می‌توانی آدرس سرور شخصی خودت یا IP و پورت را وارد کنی."
          />

          <Field
            label="ایمیل یا نام کاربری"
            required
            autoComplete="username"
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
            error={errors.identity}
          />

          <div>
            <Field
              label="گذرواژه"
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
            />
            <button type="button" className="mt-1.5 text-sm text-link hover:underline">
              گذرواژه را فراموش کردی؟
            </button>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-t3 select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="size-4 shrink-0 appearance-none rounded-[3px] border-2 border-t4 bg-transparent
                         checked:border-brand checked:bg-brand
                         checked:after:block checked:after:text-center checked:after:text-[11px]
                         checked:after:leading-[13px] checked:after:text-white checked:after:content-['✓']"
            />
            مرا به خاطر بسپار
          </label>

          {errors.form && <p className="text-sm text-[#ff8a8d]">{errors.form}</p>}

          <Button type="submit" block size="lg" loading={busy}>
            ورود
          </Button>

          <p className="text-sm text-t4">
            حساب نداری؟{" "}
            <Link href="/register" className="text-link hover:underline">
              ثبت‌نام کن
            </Link>
          </p>
        </form>
      </div>

      <QrPanel />

      <span className="tnum absolute bottom-2 end-3 text-2xs text-t5">
        نسخه {fa(APP_VERSION)}
      </span>
    </Reveal>
  );
}
