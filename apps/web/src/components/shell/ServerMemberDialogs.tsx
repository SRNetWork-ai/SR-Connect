"use client";

import { Bell, BellOff, Flag, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useApp } from "@/store/use-app";

export type ServerDialog = "notifications" | "report" | "leave" | null;

interface NotificationPrefs {
  level: "all" | "mentions" | "nothing";
  suppressEveryone: boolean;
  muteUntil: string | null;
}

const LEVELS: { id: NotificationPrefs["level"]; label: string; hint: string }[] = [
  { id: "all", label: "همه‌ی پیام‌ها", hint: "برای هر پیام تازه اعلان بگیر" },
  { id: "mentions", label: "فقط منشن‌ها", hint: "فقط وقتی اسمت برده شد" },
  { id: "nothing", label: "هیچ‌چیز", hint: "اعلان این سرور کاملاً خاموش" },
];

const MUTE_OPTIONS: { label: string; minutes: number | null }[] = [
  { label: "بدون بی‌صدا", minutes: null },
  { label: "۱۵ دقیقه", minutes: 15 },
  { label: "۱ ساعت", minutes: 60 },
  { label: "۸ ساعت", minutes: 480 },
  { label: "۲۴ ساعت", minutes: 1440 },
];

/** دیالوگ‌های منوی سرور برای اعضا: اعلان، گزارش و ترک سرور. */
export function ServerMemberDialogs({
  dialog,
  onClose,
}: {
  dialog: ServerDialog;
  onClose: () => void;
}) {
  const pushToast = useApp((s) => s.pushToast);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (dialog !== "notifications") return;
    void api
      .get<{ notifications: NotificationPrefs }>("/api/notifications/server")
      .then((data) => setPrefs(data.notifications))
      .catch((error) => pushToast((error as Error).message, "error"));
  }, [dialog, pushToast]);

  async function saveNotifications(patch: Partial<NotificationPrefs>) {
    const next = {
      ...(prefs ?? { level: "all", suppressEveryone: false, muteUntil: null }),
      ...patch,
    };
    setPrefs(next as NotificationPrefs);
    try {
      const data = await api.patch<{ notifications: NotificationPrefs }>(
        "/api/notifications/server",
        next,
      );
      setPrefs(data.notifications);
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  }

  async function sendReport() {
    setBusy(true);
    try {
      await api.post("/api/reports", { targetType: "server", reason });
      setReason("");
      onClose();
      pushToast("گزارش ثبت شد و برای مدیران قابل مشاهده است", "success");
    } catch (error) {
      pushToast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function leaveServer() {
    setBusy(true);
    try {
      await api.post("/api/servers/leave");
      window.location.href = "/login";
    } catch (error) {
      pushToast((error as Error).message, "error");
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog
        open={dialog === "notifications"}
        onClose={onClose}
        title="تنظیمات اعلان سرور"
        description="این تنظیم فقط روی حساب خودت اثر دارد."
      >
        <div className="space-y-2">
          {LEVELS.map((level) => (
            <button
              key={level.id}
              onClick={() => void saveNotifications({ level: level.id })}
              className={cn(
                "flex w-full items-start gap-3 rounded-md p-3 text-start",
                prefs?.level === level.id ? "bg-brand-soft" : "bg-card hover:bg-hover",
              )}
            >
              {level.id === "nothing" ? (
                <BellOff className="mt-0.5 size-4 text-t4" />
              ) : (
                <Bell className="mt-0.5 size-4 text-t4" />
              )}
              <span>
                <strong className="block text-sm text-t1">{level.label}</strong>
                <span className="text-xs text-t4">{level.hint}</span>
              </span>
            </button>
          ))}
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-t2">
          <input
            type="checkbox"
            checked={prefs?.suppressEveryone ?? false}
            onChange={(event) => void saveNotifications({ suppressEveryone: event.target.checked })}
            className="size-4 accent-[var(--color-brand)]"
          />
          بی‌خیالِ ‎@everyone و ‎@here
        </label>

        <div className="mt-4">
          <p className="mb-2 text-xs font-bold text-t3">بی‌صدا کردن موقت</p>
          <div className="flex flex-wrap gap-1.5">
            {MUTE_OPTIONS.map((option) => (
              <button
                key={option.label}
                onClick={() =>
                  void saveNotifications({
                    muteUntil: option.minutes
                      ? new Date(Date.now() + option.minutes * 60_000).toISOString()
                      : null,
                  })
                }
                className="rounded-pill bg-card px-3 py-1.5 text-xs text-t3 hover:bg-hover"
              >
                {option.label}
              </button>
            ))}
          </div>
          {prefs?.muteUntil && (
            <p className="mt-2 text-xs text-warning">
              تا {new Date(prefs.muteUntil).toLocaleString("fa-IR")} بی‌صدا است.
            </p>
          )}
        </div>
      </Dialog>

      <Dialog
        open={dialog === "report"}
        onClose={onClose}
        title="گزارش سرور"
        description="گزارش به مدیران سرور می‌رسد و هویت تو برایشان مشخص است."
        footer={
          <Button
            loading={busy}
            disabled={reason.trim().length < 5}
            onClick={() => void sendReport()}
          >
            <Flag className="size-4" /> ارسال گزارش
          </Button>
        }
      >
        <textarea
          rows={5}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="چه اتفاقی افتاد؟ هرچه دقیق‌تر بنویسی، بررسی سریع‌تر است."
          className="w-full resize-none rounded-md bg-deep p-3 text-sm text-t2 outline-none focus:ring-1 focus:ring-brand"
        />
      </Dialog>

      <Dialog
        open={dialog === "leave"}
        onClose={onClose}
        title="ترک سرور"
        description="نقش‌هایت برداشته می‌شود و از همه‌ی دستگاه‌ها خارج می‌شوی. برای برگشت به یک لینک دعوت تازه نیاز داری."
        footer={
          <Button variant="danger" loading={busy} onClick={() => void leaveServer()}>
            <LogOut className="size-4" /> ترک سرور
          </Button>
        }
      />
    </>
  );
}
