"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileDown,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { api } from "@/lib/api";
import { APP_VERSION, UPDATE_CHANNEL } from "@/lib/config";
import { bytes, fa } from "@/lib/fmt";
import { fetchManifest } from "@/lib/updater/client";
import { decide } from "@/lib/updater/decide";
import { downloadArtifact } from "@/lib/updater/download";
import { installUpdate, relaunch } from "@/lib/updater/install";
import type { UpdateDecision, VersionManifest } from "@/lib/updater/types";
import { verifyArtifact } from "@/lib/updater/verify";
import { useApp } from "@/store/use-app";
import { useVoice } from "@/store/use-voice";

interface ReleaseRow {
  version: string;
  channel: string;
  mandatory: boolean;
  rollout: number;
  yanked: boolean;
  minClient: string | null;
  notes: string[];
  publishedAt: string | null;
  size: number | null;
}

type Stage = "idle" | "downloading" | "verifying" | "installing" | "done" | "failed";

const CHANNEL_LABEL: Record<string, string> = {
  stable: "پایدار",
  beta: "بتا",
  nightly: "شبانه",
};

export function UpdateCenter() {
  const inCall = useVoice((s) => s.status === "connected");
  const isAdmin = useApp((s) => Boolean(s.me?.isAdmin));
  const [manifest, setManifest] = useState<VersionManifest | null>(null);
  const [decision, setDecision] = useState<UpdateDecision | null>(null);
  const [releases, setReleases] = useState<ReleaseRow[]>([]);
  const [distribution, setDistribution] = useState<{ version: string; devices: number }[]>([]);
  const [signingConfigured, setSigningConfigured] = useState<boolean | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const m = await fetchManifest();
      setManifest(m);
      setDecision(decide({ manifest: m, inCall }));
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setChecking(false);
    }
  }, [inCall]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isAdmin) return;
    void api
      .get<{
        releases: ReleaseRow[];
        distribution: { version: string; devices: number }[];
        signingConfigured: boolean;
      }>("/api/admin/releases")
      .then((d) => {
        setReleases(d.releases);
        setDistribution(d.distribution);
        setSigningConfigured(d.signingConfigured);
      })
      .catch(() => {});
  }, [isAdmin]);

  async function patchRelease(version: string, patch: Partial<ReleaseRow>) {
    try {
      await api.patch("/api/admin/releases", { version, ...patch });
      setReleases((rs) => rs.map((x) => (x.version === version ? { ...x, ...patch } : x)));
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  async function install() {
    if (!decision || !("artifact" in decision)) return;
    const artifact = decision.artifact;
    setMessage(null);
    try {
      setStage("downloading");
      setProgress(0);
      const payload = await downloadArtifact(artifact, (p) => setProgress(p.ratio));

      setStage("verifying");
      const check = await verifyArtifact(payload, artifact.sha256, artifact.sig);
      if (!check.hashOk) {
        setStage("failed");
        setMessage("هش بسته با مانیفست نمی‌خواند؛ نصب لغو شد.");
        return;
      }
      if (!check.signature.ok) {
        setStage("failed");
        setMessage(`امضای بسته تأیید نشد (${check.signature.reason})؛ نصب لغو شد.`);
        return;
      }

      setStage("installing");
      const result = await installUpdate(payload, { version: decision.target, artifact });
      setStage("done");
      setMessage(`${result.detail} — برای اجرای نسخه‌ی جدید اپ را دوباره باز کن.`);
    } catch (err) {
      setStage("failed");
      setMessage((err as Error).message);
    }
  }

  const target = decision && "target" in decision ? decision.target : null;
  const upToDate = decision?.kind === "up-to-date";

  return (
    <div className="scroll-y flex-1 p-6">
      <div className="mx-auto max-w-[760px] space-y-5">
        <header className="flex items-center gap-3">
          <Download className="size-6 text-brand" />
          <div>
            <h1 className="text-xl font-bold text-t1">مرکز آپدیت</h1>
            <p className="text-sm text-t4">
              نسخه‌ی این کلاینت <span className="tnum">{fa(APP_VERSION)}</span> · کانال{" "}
              {CHANNEL_LABEL[UPDATE_CHANNEL] ?? UPDATE_CHANNEL}
            </p>
          </div>
          <Button
            variant="neutral"
            size="sm"
            className="ms-auto"
            loading={checking}
            onClick={() => void refresh()}
          >
            <RefreshCw className="size-3.5" />
            بررسی مجدد
          </Button>
        </header>

        <section className="rounded-lg bg-card p-5">
          <div className="flex items-start gap-3">
            {upToDate ? (
              <CheckCircle2 className="mt-0.5 size-5 text-success" />
            ) : decision?.kind === "mandatory" ? (
              <AlertTriangle className="mt-0.5 size-5 text-danger" />
            ) : (
              <Download className="mt-0.5 size-5 text-brand" />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-t1">
                {upToDate
                  ? "همه‌چیز به‌روز است"
                  : decision?.kind === "mandatory"
                    ? `آپدیت اجباری ${fa(target ?? "")}`
                    : decision?.kind === "deferred"
                      ? `نسخه ${fa(target ?? "")} آماده است — نصب به تعویق افتاد`
                      : decision?.kind === "offline"
                        ? "سرور آپدیت در دسترس نیست"
                        : `نسخه ${fa(target ?? "")} آماده‌ی نصب است`}
              </h2>
              {decision?.kind === "deferred" && (
                <p className="mt-1 text-sm text-t4">
                  {decision.reason === "in-call"
                    ? "وسط تماس صوتی هستی؛ نصب بعد از قطع تماس انجام می‌شود."
                    : decision.reason === "rollout-held"
                      ? "این نسخه پله‌ای منتشر می‌شود و هنوز به دستگاه تو نرسیده."
                      : "نسخه‌ی جدیدی نیست."}
                </p>
              )}
              {manifest?.notes?.length ? (
                <ul className="mt-3 space-y-1 text-sm text-t3">
                  {manifest.notes.map((n) => (
                    <li key={n} className="flex gap-2">
                      <span className="text-t5">•</span>
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {decision && "artifact" in decision && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge tone="outline">
                    <FileDown className="size-3" />
                    {decision.artifact.from
                      ? `دلتا از ${fa(decision.artifact.from)} · ${bytes(decision.artifact.size)}`
                      : `بسته‌ی کامل · ${bytes(decision.artifact.size)}`}
                  </Badge>
                  <Badge tone="outline">
                    <ShieldCheck className="size-3" />
                    امضای Ed25519
                  </Badge>
                  <Button
                    size="sm"
                    className="ms-auto"
                    loading={
                      stage === "downloading" || stage === "verifying" || stage === "installing"
                    }
                    onClick={() => void install()}
                  >
                    نصب حالا
                  </Button>
                </div>
              )}

              {stage !== "idle" && (
                <div className="mt-4">
                  <Progress
                    value={stage === "downloading" ? progress : stage === "done" ? 1 : 0.9}
                    tone={stage === "failed" ? "danger" : stage === "done" ? "success" : "brand"}
                  />
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-t3">
                    {stage !== "done" && stage !== "failed" && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    {stage === "downloading"
                      ? `دریافت بسته… ${fa(Math.round(progress * 100))}٪`
                      : stage === "verifying"
                        ? "بررسی هش و امضا…"
                        : stage === "installing"
                          ? "نصب و نوشتن نسخه…"
                          : stage === "done"
                            ? "انجام شد"
                            : "ناموفق"}
                  </p>
                </div>
              )}

              {message && (
                <p className={`mt-3 text-sm ${stage === "failed" ? "text-[#ff8a8d]" : "text-t3"}`}>
                  {message}
                </p>
              )}

              {stage === "done" && (
                <Button size="sm" className="mt-3" onClick={() => void relaunch()}>
                  اجرای نسخه‌ی جدید
                </Button>
              )}
            </div>
          </div>
        </section>

        {isAdmin && (
          <section className="rounded-lg bg-card p-5">
            <h2 className="text-base font-bold text-t1">مدیریت انتشار</h2>
            {signingConfigured === false && (
              <p className="mt-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
                کلید امضای Ed25519 روی این سرور تنظیم نشده؛ تا آن را نگذاری انتشار امضاشده ممکن نیست.
              </p>
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-2xs text-t4">
                  <tr>
                    <th className="p-2 text-start">نسخه</th>
                    <th className="p-2 text-start">کانال</th>
                    <th className="p-2 text-start">اجباری</th>
                    <th className="p-2 text-start">انتشار پله‌ای</th>
                    <th className="p-2 text-start">اقدام</th>
                  </tr>
                </thead>
                <tbody className="text-t2">
                  {releases.map((r) => (
                    <tr key={r.version} className="border-t border-divider">
                      <td className="tnum p-2">{fa(r.version)}</td>
                      <td className="p-2">{CHANNEL_LABEL[r.channel] ?? r.channel}</td>
                      <td className="p-2">{r.mandatory ? "بله" : "خیر"}</td>
                      <td className="tnum p-2">{fa(r.rollout)}٪</td>
                      <td className="p-2">
                        <div className="flex gap-1.5">
                          <button
                            className="rounded-[4px] bg-hover px-2 py-1 text-2xs hover:bg-brand hover:text-white"
                            onClick={() =>
                              void patchRelease(r.version, { mandatory: !r.mandatory })
                            }
                          >
                            {r.mandatory ? "غیراجباری" : "اجباری"}
                          </button>
                          <button
                            className="rounded-[4px] bg-hover px-2 py-1 text-2xs hover:bg-brand hover:text-white"
                            onClick={() => void patchRelease(r.version, { rollout: 100 })}
                          >
                            انتشار ۱۰۰٪
                          </button>
                          <button
                            className="rounded-[4px] bg-danger-soft px-2 py-1 text-2xs text-[#ff8a8d] hover:bg-danger hover:text-white"
                            onClick={() => void patchRelease(r.version, { yanked: !r.yanked })}
                          >
                            {r.yanked ? "بازگردانی" : "پس‌گیری"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {releases.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-t4">
                        هنوز ریلیزی ثبت نشده. با <code dir="ltr">npm run sign-release</code> یا اکشن
                        انتشار گیت‌هاب اولین نسخه را بساز.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {distribution.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-bold text-t2">توزیع نسخه‌ی دستگاه‌ها</h3>
                <div className="mt-2 space-y-1.5">
                  {distribution.map((d) => {
                    const total = distribution.reduce((a, x) => a + x.devices, 0) || 1;
                    return (
                      <div key={d.version} className="flex items-center gap-2 text-sm">
                        <span className="tnum w-16 text-t3">{fa(d.version)}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-pill bg-deep">
                          <span
                            className="block h-full rounded-pill bg-brand"
                            style={{ width: `${(d.devices / total) * 100}%` }}
                          />
                        </span>
                        <span className="tnum w-10 text-end text-t4">{fa(d.devices)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
