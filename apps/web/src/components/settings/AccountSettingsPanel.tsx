"use client";

import {
  Bell,
  Brush,
  Headphones,
  LogOut,
  MessageSquareLock,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  WandSparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useApp } from "@/store/use-app";
import { useVoice } from "@/store/use-voice";

type AccountTab =
  | "account"
  | "security"
  | "privacy"
  | "notifications"
  | "booster"
  | "wishes"
  | "voice"
  | "theme"
  | "danger";

const ITEMS: { id: AccountTab; label: string; icon: typeof UserRound; soon?: boolean }[] = [
  { id: "account", label: "اطلاعات حساب", icon: UserRound },
  { id: "security", label: "امنیت", icon: ShieldCheck },
  { id: "privacy", label: "مدیریت پیوی", icon: MessageSquareLock },
  { id: "notifications", label: "اعلان‌ها", icon: Bell },
  { id: "booster", label: "بوستر", icon: Sparkles, soon: true },
  { id: "wishes", label: "ویش‌های سرور", icon: WandSparkles, soon: true },
  { id: "voice", label: "ویس و ویدیو", icon: Headphones },
  { id: "theme", label: "تم", icon: Brush },
  { id: "danger", label: "خروج و حذف حساب", icon: Trash2 },
];

interface Preferences {
  allowDmFrom: "everyone" | "friends" | "nobody";
  notifyMessages: boolean;
  notifyMentions: boolean;
  notifyCalls: boolean;
  theme: "dark" | "midnight" | "contrast";
}

export function AccountSettingsPanel() {
  const [tab, setTab] = useState<AccountTab>("account");

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="scroll-y w-[250px] shrink-0 bg-sidebar-deep p-4">
        <h1 className="mb-3 px-2 text-base font-black text-t1">تنظیمات شخصی</h1>
        {ITEMS.map(({ id, label, icon: Icon, soon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm",
              tab === id ? "bg-brand text-white" : "text-t3 hover:bg-hover hover:text-t1",
            )}
          >
            <Icon className="size-4" />
            <span>{label}</span>
            {soon && <span className="ms-auto text-[9px] font-black opacity-70">SOON</span>}
          </button>
        ))}
      </aside>
      <main className="scroll-y flex-1 p-7">
        <div className="mx-auto max-w-[720px]">
          {tab === "account" ? (
            <AccountInfo />
          ) : tab === "security" ? (
            <SecuritySettings />
          ) : tab === "voice" ? (
            <VoiceSettings />
          ) : tab === "danger" ? (
            <DangerSettings />
          ) : tab === "privacy" || tab === "notifications" || tab === "theme" ? (
            <PreferenceSettings tab={tab} />
          ) : (
            <AccountSection tab={tab} />
          )}
        </div>
      </main>
    </div>
  );
}

function SecuritySettings() {
  const router = useRouter();
  const pushToast = useApp((s) => s.pushToast);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.patch("/api/users/security", { currentPassword, newPassword });
      pushToast("رمز تغییر کرد؛ دوباره وارد شو", "success");
      router.replace("/login");
    } catch (error) {
      pushToast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard title="امنیت">
      <form onSubmit={changePassword} className="space-y-4">
        <Field
          label="رمز فعلی"
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
        />
        <Field
          label="رمز جدید"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
        />
        <p className="text-xs text-t5">حداقل ۱۰ نویسه، شامل حرف و عدد. همه نشست‌ها خارج می‌شوند.</p>
        <Button loading={busy} disabled={!currentPassword || !newPassword}>
          تغییر رمز
        </Button>
      </form>
    </SettingsCard>
  );
}

function DangerSettings() {
  const router = useRouter();
  const leave = useVoice((s) => s.leave);
  const pushToast = useApp((s) => s.pushToast);
  const [password, setPassword] = useState("");
  const [confirming, setConfirming] = useState(false);

  async function logout() {
    await leave();
    await api.post("/api/auth/logout").catch(() => {});
    router.replace("/login");
  }

  async function removeAccount() {
    if (!password || !confirming) return;
    try {
      await api.del("/api/users/me", { password });
      await leave();
      router.replace("/register");
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  }

  return (
    <section>
      <h2 className="text-xl font-black text-t1">خروج و حذف حساب</h2>
      <div className="mt-5 space-y-4 rounded-xl border border-danger/30 bg-card p-5">
        <Button onClick={() => void logout()}>
          <LogOut className="size-4" /> خروج از حساب
        </Button>
        <div className="border-t border-divider pt-4">
          <Field
            label="رمز حساب برای حذف دائمی"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
          <label className="mt-3 flex items-center gap-2 text-xs text-t3">
            <input
              type="checkbox"
              checked={confirming}
              onChange={(event) => setConfirming(event.target.checked)}
              className="size-4 accent-danger"
            />
            می‌دانم پیام‌ها و اطلاعات حساب قابل‌بازیابی نیست.
          </label>
          <button
            onClick={() => void removeAccount()}
            disabled={!password || !confirming}
            className="mt-4 rounded-md bg-danger px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            حذف دائمی حساب
          </button>
        </div>
      </div>
    </section>
  );
}

function PreferenceSettings({ tab }: { tab: "privacy" | "notifications" | "theme" }) {
  const pushToast = useApp((s) => s.pushToast);
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  useEffect(() => {
    void api
      .get<{ preferences: Preferences }>("/api/users/preferences")
      .then((data) => setPreferences(data.preferences))
      .catch((error) => pushToast((error as Error).message, "error"));
  }, [pushToast]);

  async function patch(update: Partial<Preferences>) {
    if (!preferences) return;
    const before = preferences;
    setPreferences({ ...preferences, ...update });
    try {
      const data = await api.patch<{ preferences: Preferences }>("/api/users/preferences", update);
      setPreferences(data.preferences);
      pushToast("تنظیمات ذخیره شد", "success");
    } catch (error) {
      setPreferences(before);
      pushToast((error as Error).message, "error");
    }
  }

  if (!preferences) return <p className="text-sm text-t4">در حال بارگذاری تنظیمات…</p>;
  if (tab === "privacy") {
    return (
      <SettingsCard title="مدیریت پیوی">
        <label className="block text-sm font-bold text-t2">
          چه کسانی می‌توانند پیام خصوصی بدهند؟
          <select
            value={preferences.allowDmFrom}
            onChange={(event) =>
              void patch({ allowDmFrom: event.target.value as Preferences["allowDmFrom"] })
            }
            className="mt-3 block h-10 w-full rounded-md bg-deep px-3 text-t2 outline-none"
          >
            <option value="everyone">همه</option>
            <option value="friends">فقط دوستان</option>
            <option value="nobody">هیچ‌کس</option>
          </select>
        </label>
      </SettingsCard>
    );
  }
  if (tab === "theme") {
    return (
      <SettingsCard title="تم">
        <div className="grid gap-2 sm:grid-cols-3">
          {(["dark", "midnight", "contrast"] as const).map((theme) => (
            <button
              key={theme}
              onClick={() => void patch({ theme })}
              className={cn(
                "rounded-lg border p-4 text-sm font-bold",
                preferences.theme === theme
                  ? "border-brand bg-brand-soft text-t1"
                  : "border-divider bg-deep text-t4",
              )}
            >
              {theme === "dark" ? "تیره" : theme === "midnight" ? "نیمه‌شب" : "کنتراست بالا"}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-t5">
          انتخاب تم ذخیره می‌شود؛ پالت‌های تکمیلی در حال طراحی‌اند.
        </p>
      </SettingsCard>
    );
  }
  return (
    <SettingsCard title="اعلان‌ها">
      <ToggleRow
        label="پیام‌های جدید"
        checked={preferences.notifyMessages}
        onChange={(value) => void patch({ notifyMessages: value })}
      />
      <ToggleRow
        label="منشن‌ها"
        checked={preferences.notifyMentions}
        onChange={(value) => void patch({ notifyMentions: value })}
      />
      <ToggleRow
        label="تماس‌های خصوصی"
        checked={preferences.notifyCalls}
        onChange={(value) => void patch({ notifyCalls: value })}
      />
    </SettingsCard>
  );
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-black text-t1">{title}</h2>
      <div className="mt-5 space-y-2 rounded-xl bg-card p-5">{children}</div>
    </section>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-md bg-deep px-4 py-3 text-sm font-bold text-t2">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-brand"
      />
    </label>
  );
}

function VoiceSettings() {
  const enabled = useVoice((s) => s.noiseCancellation);
  const active = useVoice((s) => s.noiseFilterActive);
  const connected = useVoice((s) => s.status === "connected");
  const toggle = useVoice((s) => s.toggleNoiseCancellation);

  return (
    <section>
      <h2 className="text-xl font-black text-t1">ویس و ویدیو</h2>
      <div className="mt-5 rounded-xl bg-card p-5">
        <div className="flex items-center gap-4">
          <span className="grid size-11 place-items-center rounded-lg bg-brand-soft text-brand">
            <WandSparkles className="size-5" />
          </span>
          <span className="flex-1">
            <strong className="block text-t1">نویزگیر هوشمند Krisp</strong>
            <span className="mt-1 block text-xs leading-6 text-t4">
              صدای فن، کیبورد و نویز محیط قبل از ارسال میکروفون حذف می‌شود.
            </span>
            {connected && enabled && (
              <span className={cn("text-2xs font-bold", active ? "text-success" : "text-warning")}>
                {active ? "فعال روی میکروفون فعلی" : "در حال آماده‌سازی یا پشتیبانی‌نشده"}
              </span>
            )}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => void toggle()}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-pill transition-colors",
              enabled ? "bg-success" : "bg-deep",
            )}
          >
            <span
              className={cn(
                "absolute top-1 size-5 rounded-full bg-white shadow transition-[left,right]",
                enabled ? "end-1" : "start-1",
              )}
            />
          </button>
        </div>
        <p className="mt-4 border-t border-divider pt-4 text-xs leading-6 text-t5">
          فیلتر استاندارد مرورگر نیز فعال می‌ماند. انتخاب شما روی همین دستگاه ذخیره می‌شود و در
          تماس‌های بعدی به‌صورت خودکار اعمال خواهد شد.
        </p>
      </div>
    </section>
  );
}

function AccountInfo() {
  const me = useApp((s) => s.me);
  const updateProfile = useApp((s) => s.updateProfile);
  const [displayName, setDisplayName] = useState(me?.displayName ?? "");
  const [bio, setBio] = useState(me?.bio ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await updateProfile({ displayName, bio });
    setBusy(false);
  }

  return (
    <section>
      <h2 className="text-xl font-black text-t1">اطلاعات حساب</h2>
      <div className="mt-5 rounded-xl bg-card p-5">
        <div className="mb-5 flex items-center gap-3">
          <Avatar
            name={me?.displayName ?? "کاربر"}
            color={me?.avatarColor ?? "#5865F2"}
            url={me?.avatarUrl}
            size="xl"
          />
          <div>
            <strong className="block text-t1">{me?.displayName}</strong>
            <span className="text-xs text-t4" dir="ltr">
              @{me?.username}
            </span>
          </div>
        </div>
        <div className="space-y-4">
          <Field
            label="نام نمایشی"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-bold text-t3">درباره‌ی من</span>
            <textarea
              rows={4}
              maxLength={280}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full resize-none rounded-md bg-deep px-3 py-2 text-t2 outline-none focus:ring-1 focus:ring-brand"
            />
          </label>
          <Button loading={busy} onClick={() => void save()}>
            ذخیره تغییرات
          </Button>
        </div>
      </div>
    </section>
  );
}

function AccountSection({ tab }: { tab: Exclude<AccountTab, "account"> }) {
  const router = useRouter();
  const leave = useVoice((s) => s.leave);
  const pushToast = useApp((s) => s.pushToast);
  const item = ITEMS.find((entry) => entry.id === tab)!;

  async function logout() {
    await leave();
    await api.post("/api/auth/logout").catch(() => {});
    router.replace("/login");
  }

  if (tab === "danger") {
    return (
      <section>
        <h2 className="text-xl font-black text-t1">خروج و حذف حساب</h2>
        <div className="mt-5 space-y-3 rounded-xl border border-danger/30 bg-card p-5">
          <Button onClick={() => void logout()}>
            <LogOut className="size-4" />
            خروج از حساب
          </Button>
          <button
            onClick={() =>
              pushToast("حذف حساب بعد از اضافه‌شدن تأیید امنیتی فعال می‌شود", "warning")
            }
            className="block text-sm font-bold text-danger hover:underline"
          >
            حذف دائمی حساب
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-xl font-black text-t1">{item.label}</h2>
      <div className="mt-5 rounded-xl bg-card p-8 text-center">
        <item.icon className="mx-auto size-10 text-brand" />
        <p className="mt-4 text-sm text-t3">
          {item.soon
            ? "این بخش Coming Soon است."
            : "ساختار این بخش آماده شده و تنظیمات آن در نسخه‌ی بعد به API متصل می‌شود."}
        </p>
      </div>
    </section>
  );
}
