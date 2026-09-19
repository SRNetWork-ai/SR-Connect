"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { Logo, Wordmark } from "@/components/ui/Logo";
import { Reveal } from "@/components/ui/Reveal";
import { api, ApiError } from "@/lib/api";

export function RegisterForm() {
  const router = useRouter();
  const [features, setFeatures] = useState<{ registration: boolean; requireInvite: boolean } | null>(
    null,
  );
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    email: "",
    password: "",
    invite: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .get<{ registration: boolean; requireInvite: boolean }>("/api/health")
      .then((h) => setFeatures({ registration: h.registration, requireInvite: h.requireInvite }))
      .catch(() => setFeatures({ registration: true, requireInvite: false }));
  }, []);

  const strength = scorePassword(form.password);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/auth/register", form);
      router.replace("/app");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ثبت‌نام ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  if (features && !features.registration) {
    return (
      <div className="w-full max-w-[420px] rounded-[6px] bg-sidebar p-8 text-center shadow-float">
        <div className="flex justify-center">
          <Logo size={44} glow />
        </div>
        <h1 className="mt-4 text-xl font-bold text-t1">ثبت‌نام بسته است</h1>
        <p className="mt-2 text-sm text-t3">
          مدیر این سرور ثبت‌نام آزاد را خاموش کرده است. برای عضویت یک دعوت‌نامه بگیر.
        </p>
        <Link href="/login" className="mt-5 inline-block text-sm text-link hover:underline">
          بازگشت به ورود
        </Link>
      </div>
    );
  }

  return (
    <Reveal
      y={12}
      duration={0.35}
      className="relative w-full max-w-[460px] rounded-[6px] bg-sidebar p-8 shadow-float"
    >
      <header className="text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <Logo size={40} glow />
          <Wordmark className="text-lg" />
        </div>
        <h1 className="text-2xl font-bold text-t1">ساخت حساب</h1>
        <p className="mt-1 text-base text-t3">اولین کاربر سرور، خودکار مدیر می‌شود</p>
      </header>

      <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
        <Field
          label="نام کاربری"
          required
          dir="ltr"
          className="text-start"
          autoComplete="username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          hint="حروف کوچک انگلیسی، رقم، نقطه و خط تیره — ۳ تا ۲۴ نویسه"
        />
        <Field
          label="نام نمایشی"
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          hint="اختیاری — اگر خالی بماند از نام کاربری استفاده می‌شود"
        />
        <Field
          label="ایمیل"
          type="email"
          dir="ltr"
          className="text-start"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          hint="اختیاری — فقط برای بازیابی گذرواژه"
        />
        <div>
          <Field
            label="گذرواژه"
            required
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <div className="mt-2 flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-pill transition-colors ${
                  i < strength.score
                    ? ["bg-danger", "bg-warning", "bg-success", "bg-success"][strength.score - 1]
                    : "bg-divider"
                }`}
              />
            ))}
          </div>
          <p className="mt-1 text-2xs text-t4">{strength.label}</p>
        </div>

        {features?.requireInvite && (
          <Field
            label="کد دعوت"
            required
            dir="ltr"
            className="text-start"
            value={form.invite}
            onChange={(e) => setForm({ ...form, invite: e.target.value })}
          />
        )}

        {error && <p className="text-sm text-[#ff8a8d]">{error}</p>}

        <Button type="submit" block size="lg" loading={busy}>
          ساخت حساب
        </Button>

        <p className="text-sm text-t4">
          حساب داری؟{" "}
          <Link href="/login" className="text-link hover:underline">
            وارد شو
          </Link>
        </p>
      </form>
    </Reveal>
  );
}

function scorePassword(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: "حداقل ۱۰ نویسه با حرف و رقم" };
  let score = 0;
  if (pw.length >= 10) score += 1;
  if (pw.length >= 14) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) score += 1;
  const labels = ["خیلی ضعیف", "ضعیف", "قابل قبول", "خوب", "عالی"];
  return { score, label: labels[score]! };
}
