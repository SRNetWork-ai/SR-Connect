"use client";

import {
  AlertTriangle,
  Download,
  Plus,
  RotateCcw,
  Save,
  Smile,
  Sticker,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fa } from "@/lib/fmt";
import { useApp } from "@/store/use-app";

type OnError = (error: string | null) => void;

interface ServerEmoji {
  id: string;
  name: string;
  kind: "emoji" | "sticker";
  url: string;
  size: number;
  createdBy?: string | null;
}

/* ───────────────────────────── ایموجی و استیکر ───────────────────────────── */

export function EmojiTab({ onError }: { onError: OnError }) {
  const [items, setItems] = useState<ServerEmoji[]>([]);
  const [kind, setKind] = useState<"emoji" | "sticker">("emoji");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pushToast = useApp((s) => s.pushToast);

  const load = useCallback(
    () =>
      api
        .get<{ emojis: ServerEmoji[] }>("/api/admin/emojis")
        .then((data) => setItems(data.emojis))
        .catch((error) => onError((error as Error).message)),
    [onError],
  );
  useEffect(() => void load(), [load]);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !name.trim()) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("name", name.trim().toLowerCase());
      form.append("file", file);
      await api.upload("/api/admin/emojis", form);
      setName("");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onError(null);
      await load();
      pushToast(kind === "emoji" ? "ایموجی اضافه شد" : "استیکر اضافه شد", "success");
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.del(`/api/admin/emojis?id=${encodeURIComponent(id)}`);
      await load();
    } catch (error) {
      onError((error as Error).message);
    }
  }

  const shown = items.filter((item) => item.kind === kind);

  return (
    <section className="space-y-4 card-3d rounded-lg p-5">
      <div className="grid grid-cols-2 gap-1 rounded-md bg-deep p-1">
        {(
          [
            ["emoji", "ایموجی", Smile],
            ["sticker", "استیکر", Sticker],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setKind(id)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-[5px] px-3 py-2 text-sm font-bold",
              kind === id ? "card-3d text-t1" : "text-t4 hover:text-t2",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <form
        onSubmit={upload}
        className="grid gap-3 rounded-md bg-deep p-4 sm:grid-cols-[1fr_1fr_auto]"
      >
        <Field
          label="نام کوتاه"
          value={name}
          dir="ltr"
          placeholder="party_blob"
          onChange={(event) => setName(event.target.value)}
        />
        <label className="block text-sm">
          <span className="mb-1.5 block text-xs font-bold text-t3">
            تصویر ({kind === "emoji" ? "تا ۵۱۲ کیلوبایت" : "تا ۱ مگابایت"})
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="h-10 w-full rounded-[4px] bg-card px-2 text-xs text-t3 file:me-2 file:rounded file:border-0 file:bg-brand file:px-2 file:py-1 file:text-xs file:text-white"
          />
        </label>
        <Button type="submit" loading={busy} disabled={!file || !name.trim()} className="self-end">
          <Upload className="size-4" />
          آپلود
        </Button>
      </form>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
        {shown.map((item) => (
          <figure
            key={item.id}
            className="group relative grid place-items-center gap-1 rounded-md bg-deep p-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={item.name}
              className={cn("object-contain", kind === "emoji" ? "size-10" : "size-16")}
            />
            <figcaption className="w-full truncate text-center text-2xs text-t4" dir="ltr">
              :{item.name}:
            </figcaption>
            <button
              type="button"
              onClick={() => void remove(item.id)}
              aria-label={`حذف ${item.name}`}
              className="absolute end-1 top-1 hidden rounded bg-danger/90 p-1 text-white group-hover:block"
            >
              <Trash2 className="size-3" />
            </button>
          </figure>
        ))}
        {shown.length === 0 && (
          <p className="col-span-full py-6 text-center text-sm text-t4">
            هنوز {kind === "emoji" ? "ایموجی" : "استیکری"} آپلود نشده است.
          </p>
        )}
      </div>
      <p className="text-xs text-t5">
        {fa(shown.length)} مورد از این نوع ذخیره شده و در پیکر پیام‌ها در دسترس اعضاست.
      </p>
    </section>
  );
}

/* ───────────────────────────── ولکام اسکرین ───────────────────────────── */

interface WelcomeScreen {
  enabled: boolean;
  title: string;
  description: string;
  channels: { channelId: string; description: string }[];
  rules: string[];
  buttonLabel: string;
}

export function WelcomeTab({ onError }: { onError: OnError }) {
  const channels = useApp((s) => s.channels);
  const pushToast = useApp((s) => s.pushToast);
  const [welcome, setWelcome] = useState<WelcomeScreen | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api
      .get<{ welcome: WelcomeScreen }>("/api/admin/welcome")
      .then((data) => setWelcome(data.welcome))
      .catch((error) => onError((error as Error).message));
  }, [onError]);

  if (!welcome) return <p className="text-sm text-t4">در حال بارگذاری ولکام اسکرین…</p>;
  const set = (patch: Partial<WelcomeScreen>) => setWelcome({ ...welcome, ...patch });

  async function save() {
    setBusy(true);
    try {
      const data = await api.patch<{ welcome: WelcomeScreen }>("/api/admin/welcome", welcome);
      setWelcome(data.welcome);
      onError(null);
      pushToast("ولکام اسکرین ذخیره شد", "success");
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 card-3d rounded-lg p-5">
      <label className="flex items-center gap-2 text-sm text-t2">
        <input
          type="checkbox"
          checked={welcome.enabled}
          onChange={(event) => set({ enabled: event.target.checked })}
          className="size-4 accent-[var(--color-brand)]"
        />
        نمایش ولکام اسکرین به تازه‌واردها
      </label>

      <Field
        label="عنوان"
        value={welcome.title}
        onChange={(event) => set({ title: event.target.value })}
      />
      <label className="block text-sm">
        <span className="mb-1.5 block text-xs font-bold text-t3">توضیح کوتاه</span>
        <textarea
          rows={3}
          value={welcome.description}
          onChange={(event) => set({ description: event.target.value })}
          className="w-full resize-none rounded-[4px] bg-deep p-3 text-sm text-t2 outline-none focus:ring-1 focus:ring-brand"
        />
      </label>
      <Field
        label="متن دکمه"
        value={welcome.buttonLabel}
        onChange={(event) => set({ buttonLabel: event.target.value })}
      />

      <div>
        <p className="mb-2 text-xs font-bold text-t3">کانال‌های پیشنهادی (حداکثر ۵)</p>
        <div className="space-y-2">
          {welcome.channels.map((item, index) => (
            <div key={index} className="flex gap-2">
              <select
                value={item.channelId}
                onChange={(event) => {
                  const next = [...welcome.channels];
                  next[index] = { ...item, channelId: event.target.value };
                  set({ channels: next });
                }}
                className="h-10 rounded-[4px] bg-deep px-2 text-sm text-t2 outline-none"
              >
                <option value="">انتخاب کانال</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
              <input
                value={item.description}
                placeholder="چرا این کانال مهم است؟"
                onChange={(event) => {
                  const next = [...welcome.channels];
                  next[index] = { ...item, description: event.target.value };
                  set({ channels: next });
                }}
                className="well-3d h-10 min-w-0 flex-1 rounded-[7px] px-3 text-sm text-t2 outline-none focus:ring-1 focus:ring-brand"
              />
              <button
                type="button"
                aria-label="حذف کانال"
                onClick={() => set({ channels: welcome.channels.filter((_, i) => i !== index) })}
                className="grid size-10 place-items-center rounded-[4px] bg-deep text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        {welcome.channels.length < 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() =>
              set({ channels: [...welcome.channels, { channelId: "", description: "" }] })
            }
          >
            <Plus className="size-3.5" /> افزودن کانال
          </Button>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-t3">قوانین (حداکثر ۱۰)</p>
        <div className="space-y-2">
          {welcome.rules.map((rule, index) => (
            <div key={index} className="flex gap-2">
              <input
                value={rule}
                onChange={(event) => {
                  const next = [...welcome.rules];
                  next[index] = event.target.value;
                  set({ rules: next });
                }}
                className="well-3d h-10 min-w-0 flex-1 rounded-[7px] px-3 text-sm text-t2 outline-none focus:ring-1 focus:ring-brand"
              />
              <button
                type="button"
                aria-label="حذف قانون"
                onClick={() => set({ rules: welcome.rules.filter((_, i) => i !== index) })}
                className="grid size-10 place-items-center rounded-[4px] bg-deep text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        {welcome.rules.length < 10 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => set({ rules: [...welcome.rules, ""] })}
          >
            <Plus className="size-3.5" /> افزودن قانون
          </Button>
        )}
      </div>

      <Button loading={busy} onClick={() => void save()}>
        <Save className="size-4" /> ذخیره ولکام اسکرین
      </Button>
    </section>
  );
}

/* ───────────────────────────── بکاپ و بازیابی ───────────────────────────── */

interface Backup {
  id: string;
  note: string;
  size: number;
  createdAt: string;
  createdBy: string | null;
}

export function BackupTab({ onError }: { onError: OnError }) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const pushToast = useApp((s) => s.pushToast);
  const refreshChannels = useApp((s) => s.refreshChannels);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    () =>
      api
        .get<{ backups: Backup[] }>("/api/admin/backup")
        .then((data) => setBackups(data.backups))
        .catch((error) => onError((error as Error).message)),
    [onError],
  );
  useEffect(() => void load(), [load]);

  async function create() {
    setBusy(true);
    try {
      await api.post("/api/admin/backup", { note });
      setNote("");
      onError(null);
      await load();
      pushToast("بکاپ گرفته شد", "success");
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function restore(id: string) {
    if (!window.confirm("ساختار سرور از این بکاپ بازیابی شود؟ چیزی حذف نمی‌شود.")) return;
    try {
      await api.patch("/api/admin/backup", { id });
      await refreshChannels();
      pushToast("بازیابی انجام شد", "success");
    } catch (error) {
      onError((error as Error).message);
    }
  }

  async function restoreFromFile(file: File) {
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      await api.patch("/api/admin/backup", { payload });
      await refreshChannels();
      pushToast("بکاپ فایل روی سرور اعمال شد", "success");
    } catch (error) {
      onError((error as Error).message || "فایل بکاپ خوانده نشد");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(id: string) {
    try {
      await api.del(`/api/admin/backup?id=${encodeURIComponent(id)}`);
      await load();
    } catch (error) {
      onError((error as Error).message);
    }
  }

  return (
    <section className="space-y-4 card-3d rounded-lg p-5">
      <p className="text-sm text-t4">
        بکاپ شامل پروفایل سرور، دسته‌ها، کانال‌ها، نقش‌ها و فهرست ایموجی‌هاست. پیام‌ها ذخیره
        نمی‌شوند تا بازیابی، گفت‌وگوی حذف‌شده را برنگرداند.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <Field
            label="یادداشت بکاپ"
            value={note}
            placeholder="مثلاً: پیش از بازطراحی کانال‌ها"
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <Button loading={busy} onClick={() => void create()}>
          <Save className="size-4" /> بکاپ جدید
        </Button>
        <Button variant="neutral" onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" /> بازیابی از فایل
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void restoreFromFile(file);
          }}
        />
      </div>

      <ul className="space-y-2">
        {backups.map((backup) => (
          <li key={backup.id} className="flex flex-wrap items-center gap-3 rounded-md bg-deep p-3">
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm text-t1">
                {backup.note || "بدون یادداشت"}
              </strong>
              <span className="text-xs text-t4">
                {new Date(backup.createdAt).toLocaleString("fa-IR")} ·{" "}
                {fa(Math.max(1, Math.round(backup.size / 1024)))} کیلوبایت
                {backup.createdBy ? ` · ${backup.createdBy}` : ""}
              </span>
            </span>
            <a
              href={`/api/admin/backup?download=${backup.id}`}
              className="flex items-center gap-1 text-xs text-link hover:underline"
            >
              <Download className="size-3.5" /> دانلود
            </a>
            <button
              onClick={() => void restore(backup.id)}
              className="flex items-center gap-1 text-xs text-success"
            >
              <RotateCcw className="size-3.5" /> بازیابی
            </button>
            <button
              onClick={() => void remove(backup.id)}
              className="flex items-center gap-1 text-xs text-danger"
            >
              <Trash2 className="size-3.5" /> حذف
            </button>
          </li>
        ))}
        {backups.length === 0 && (
          <li className="py-4 text-center text-sm text-t4">هنوز بکاپی گرفته نشده است.</li>
        )}
      </ul>
    </section>
  );
}

/* ───────────────────────────── حذف سرور ───────────────────────────── */

export function DangerTab({ onError }: { onError: OnError }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const pushToast = useApp((s) => s.pushToast);
  const refreshChannels = useApp((s) => s.refreshChannels);

  async function destroy() {
    setBusy(true);
    try {
      await api.post("/api/admin/danger", { password, confirm });
      setPassword("");
      setConfirm("");
      onError(null);
      await refreshChannels();
      pushToast("سرور خالی شد؛ یک بکاپ خودکار پیش از حذف ذخیره شد", "success");
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-danger/30 bg-card p-5">
      <div className="flex items-start gap-3 rounded-md bg-danger-soft p-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />
        <p className="text-sm text-[#ff8a8d]">
          همه‌ی کانال‌ها، دسته‌ها، دعوت‌نامه‌ها، ایموجی‌ها و نقش‌های غیرپیش‌فرض پاک می‌شوند. پیش از
          حذف، یک بکاپ خودکار ذخیره می‌شود. حساب کاربران و دوستی‌ها دست‌نخورده می‌ماند.
        </p>
      </div>
      <Field
        label="رمز عبور خودت"
        type="password"
        value={password}
        autoComplete="current-password"
        onChange={(event) => setPassword(event.target.value)}
      />
      <Field
        label="برای تأیید، نام سرور را دقیقاً تایپ کن"
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
      />
      <Button
        variant="danger"
        loading={busy}
        disabled={!password || !confirm}
        onClick={() => void destroy()}
      >
        <Trash2 className="size-4" /> حذف سرور
      </Button>
    </section>
  );
}

/* ───────────────────────────── گزارش‌های دریافتی ───────────────────────────── */

interface Report {
  id: string;
  targetType: "server" | "user" | "message";
  targetId: string | null;
  reason: string;
  status: "open" | "reviewed" | "dismissed";
  createdAt: string;
  reporter: string | null;
}

const TARGET_LABEL: Record<Report["targetType"], string> = {
  server: "سرور",
  user: "کاربر",
  message: "پیام",
};

const STATUS_LABEL: Record<Report["status"], string> = {
  open: "باز",
  reviewed: "بررسی‌شده",
  dismissed: "رد‌شده",
};

export function ReportsTab({ onError }: { onError: OnError }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<"open" | "all">("open");

  const load = useCallback(
    () =>
      api
        .get<{ reports: Report[] }>("/api/reports")
        .then((data) => setReports(data.reports))
        .catch((error) => onError((error as Error).message)),
    [onError],
  );
  useEffect(() => void load(), [load]);

  async function setStatus(id: string, status: Report["status"]) {
    try {
      await api.patch("/api/reports", { id, status });
      await load();
    } catch (error) {
      onError((error as Error).message);
    }
  }

  const shown = reports.filter((report) => filter === "all" || report.status === "open");

  return (
    <section className="space-y-3 card-3d rounded-lg p-5">
      <div className="grid grid-cols-2 gap-1 rounded-md bg-deep p-1">
        {(
          [
            ["open", "باز"],
            ["all", "همه"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "rounded-[5px] px-3 py-1.5 text-sm font-bold",
              filter === id ? "bg-card text-t1" : "text-t4 hover:text-t2",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {shown.map((report) => (
          <li key={report.id} className="rounded-md bg-deep p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-t4">
              <span className="rounded-pill bg-card px-2 py-0.5">
                {TARGET_LABEL[report.targetType]}
              </span>
              <span
                className={cn(
                  "rounded-pill px-2 py-0.5",
                  report.status === "open" ? "bg-warning/20 text-warning" : "bg-card",
                )}
              >
                {STATUS_LABEL[report.status]}
              </span>
              <span>{report.reporter ?? "ناشناس"}</span>
              <span>{new Date(report.createdAt).toLocaleString("fa-IR")}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-t2">{report.reason}</p>
            {report.status === "open" && (
              <div className="mt-2 flex gap-3">
                <button
                  onClick={() => void setStatus(report.id, "reviewed")}
                  className="text-xs text-success"
                >
                  بررسی شد
                </button>
                <button
                  onClick={() => void setStatus(report.id, "dismissed")}
                  className="text-xs text-danger"
                >
                  رد گزارش
                </button>
              </div>
            )}
          </li>
        ))}
        {shown.length === 0 && (
          <li className="py-6 text-center text-sm text-t4">گزارشی در این نما نیست.</li>
        )}
      </ul>
    </section>
  );
}
