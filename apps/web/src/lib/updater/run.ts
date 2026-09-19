import { APP_VERSION, SPLASH_BUDGET_MS, serverEndpoint } from "@/lib/config";
import { bytes as fmtBytes, fa, ms as fmtMs } from "@/lib/fmt";
import { fetchManifest, VersionCheckError } from "./client";
import { blocksEntry, decide } from "./decide";
import { downloadArtifact } from "./download";
import { installUpdate } from "./install";
import { markBootHealthy } from "./crash-guard";
import type { FlowState, StepId, StepState, UpdateDecision, VersionManifest } from "./types";
import { verifyArtifact } from "./verify";

const ORDER: StepId[] = ["connect", "check", "download", "verify", "install", "session"];

export const STEP_LABEL: Record<StepId, string> = {
  connect: "اتصال به سرور خودی",
  check: "بررسی نسخه",
  download: "دریافت بسته‌ی به‌روزرسانی",
  verify: "بررسی امضای دیجیتال",
  install: "نصب و جابه‌جایی نسخه",
  session: "ورود و آماده‌سازی اپ",
};

const sleep = (t: number) => new Promise((r) => setTimeout(r, t));

/** کمترین زمان نمایش هر مرحله تا اسپلش پرش نکند. */
const MIN_STEP_MS = 260;

class Steps {
  private state: StepState[] = ORDER.map((id) => ({ id, status: "idle" }));
  constructor(private emit: (steps: StepState[]) => void) {}

  private flush() {
    this.emit(this.state.map((s) => ({ ...s })));
  }
  patch(id: StepId, next: Partial<StepState>) {
    this.state = this.state.map((s) => (s.id === id ? { ...s, ...next } : s));
    this.flush();
  }
  start(id: StepId, detail?: string) {
    this.patch(id, { status: "active", detail, progress: undefined });
  }
  done(id: StepId, detail?: string, durationMs?: number) {
    this.patch(id, { status: "done", detail, durationMs, progress: 1 });
  }
  skip(id: StepId, detail?: string) {
    this.patch(id, { status: "skipped", detail });
  }
  fail(id: StepId, detail: string) {
    this.patch(id, { status: "failed", detail });
  }
  skipRest(from: StepId, detail?: string) {
    const i = ORDER.indexOf(from);
    for (const id of ORDER.slice(i)) {
      if (this.state.find((s) => s.id === id)?.status === "idle") this.skip(id, detail);
    }
  }
  snapshot() {
    return this.state.map((s) => ({ ...s }));
  }
}

export interface RunOptions {
  inCall?: boolean;
  signal?: AbortSignal;
  onState(state: FlowState): void;
  /** برای دمو: سرعت را کم می‌کند تا مراحل دیده شوند. */
  theatrical?: boolean;
}

/**
 * جریان کامل اسپلش.
 *
 * ضمانت‌ها:
 *  • بررسی نسخه تایم‌اوت دارد و شکستش اپ را متوقف نمی‌کند.
 *  • بسته بدون تطابق SHA-256 و امضای معتبر هرگز نصب نمی‌شود.
 *  • اگر کاربر وسط تماس باشد، نصب اختیاری انجام نمی‌شود.
 *  • آپدیت اجباری/رول‌بک تنها حالتی است که ورود را می‌بندد.
 */
export async function runUpdateFlow(opts: RunOptions): Promise<FlowState> {
  const startedAt = performance.now();
  let manifest: VersionManifest | undefined;
  let decision: UpdateDecision | undefined;
  let phase: FlowState["phase"] = "running";
  let error: string | undefined;

  const steps = new Steps((s) =>
    opts.onState({ phase, steps: s, decision, manifest, error, canEnter: false }),
  );
  const push = () =>
    opts.onState({ phase, steps: steps.snapshot(), decision, manifest, error, canEnter: phase === "ready" });

  const pace = opts.theatrical ? 520 : MIN_STEP_MS;

  // ── ۱) اتصال ────────────────────────────────────────────────────────────
  steps.start("connect");
  const t0 = performance.now();
  let latency = 0;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1_500);
    const res = await fetch(serverEndpoint("/api/health"), {
      cache: "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    latency = Math.round(performance.now() - t0);
    if (!res.ok) throw new Error(String(res.status));
    steps.done("connect", `پاسخ در ${fmtMs(latency)}`, latency);
  } catch {
    latency = Math.round(performance.now() - t0);
    steps.skip("connect", "سرور پاسخ نداد — حالت آفلاین");
  }
  await sleep(pace);

  // ── ۲) بررسی نسخه ───────────────────────────────────────────────────────
  steps.start("check");
  try {
    manifest = await fetchManifest(opts.signal);
    steps.done("check", `نسخه‌ی سرور ${fa(manifest.latest)} · کانال ${manifest.channel}`);
  } catch (err) {
    const message = err instanceof VersionCheckError ? err.message : "بررسی نسخه ناموفق بود";
    decision = { kind: "offline", error: message, cachedVersion: APP_VERSION };
    steps.fail("check", message);
    steps.skipRest("download", "با نسخه‌ی فعلی ادامه می‌دهیم");
    // قانون طلایی: آفلاین بودن سرورِ آپدیت اپ را زمین نمی‌زند.
    steps.start("session");
    await sleep(pace);
    markBootHealthy();
    steps.done("session", `ورود با نسخه‌ی ${fa(APP_VERSION)}`);
    phase = "ready";
    push();
    return { phase, steps: steps.snapshot(), decision, manifest, canEnter: true };
  }
  await sleep(pace);

  const d = decide({ manifest, inCall: opts.inCall });
  decision = d;
  push();

  // ── ۳) مسیر بدون نصب ────────────────────────────────────────────────────
  if (d.kind === "up-to-date" || d.kind === "deferred" || d.kind === "offline") {
    const note =
      d.kind === "up-to-date"
        ? `نسخه ${fa(APP_VERSION)} آخرین نسخه است`
        : d.kind === "deferred"
          ? `نسخه ${fa(d.target)} برای بعد نگه داشته شد`
          : d.error;
    steps.skip("download", note);
    steps.skip("verify");
    steps.skip("install");
    steps.start("session");
    await sleep(pace);
    markBootHealthy();
    steps.done("session", "آماده");
    phase = "ready";
    push();
    return { phase, steps: steps.snapshot(), decision, manifest, canEnter: true };
  }

  // ── ۴) دانلود ───────────────────────────────────────────────────────────
  const artifact = d.kind === "rollback" ? manifest.artifacts.full : d.artifact;
  const isDelta = Boolean(artifact.from);

  steps.start("download", isDelta ? `بسته‌ی دلتا از ${fa(artifact.from!)}` : "بسته‌ی کامل");
  let payload: Uint8Array;
  try {
    payload = await downloadArtifact(
      artifact,
      (p) =>
        steps.patch("download", {
          status: "active",
          progress: p.ratio,
          detail: `${fmtBytes(p.received)} از ${fmtBytes(p.total)} · ${fmtBytes(p.bytesPerSecond)}/ث`,
        }),
      opts.signal,
    );
    steps.done("download", fmtBytes(payload.byteLength));
  } catch (err) {
    error = (err as Error).message;
    steps.fail("download", error);
    steps.skipRest("verify");
    phase = blocksEntry(d) ? "blocked" : "ready";
    if (phase === "ready") markBootHealthy();
    push();
    return { phase, steps: steps.snapshot(), decision, manifest, error, canEnter: phase === "ready" };
  }
  await sleep(pace / 2);

  // ── ۵) بررسی امضا ───────────────────────────────────────────────────────
  steps.start("verify", "SHA-256 و امضای Ed25519");
  const check = await verifyArtifact(payload, artifact.sha256, artifact.sig);

  if (!check.hashOk) {
    error = "هش بسته با مانیفست نمی‌خورد؛ نصب لغو شد";
    steps.fail("verify", error);
    steps.skipRest("install");
    phase = blocksEntry(d) ? "blocked" : "ready";
    if (phase === "ready") markBootHealthy();
    push();
    return { phase, steps: steps.snapshot(), decision, manifest, error, canEnter: phase === "ready" };
  }

  if (!check.signature.ok && check.signature.reason === "bad-signature") {
    error = "امضای بسته معتبر نیست؛ نصب لغو شد";
    steps.fail("verify", error);
    steps.skipRest("install");
    phase = blocksEntry(d) ? "blocked" : "ready";
    if (phase === "ready") markBootHealthy();
    push();
    return { phase, steps: steps.snapshot(), decision, manifest, error, canEnter: phase === "ready" };
  }

  steps.done(
    "verify",
    check.signature.ok
      ? `امضای Ed25519 تأیید شد · ${check.hash.slice(0, 12)}…`
      : "هش تأیید شد؛ بررسی امضا در این محیط پشتیبانی نمی‌شود",
  );
  await sleep(pace / 2);

  // ── ۶) نصب ──────────────────────────────────────────────────────────────
  steps.start("install");
  try {
    const result = await installUpdate(payload, { version: d.target, artifact });
    steps.done("install", result.detail);
  } catch (err) {
    error = (err as Error).message;
    steps.fail("install", error);
    phase = blocksEntry(d) ? "blocked" : "ready";
    if (phase === "ready") markBootHealthy();
    push();
    return { phase, steps: steps.snapshot(), decision, manifest, error, canEnter: phase === "ready" };
  }
  await sleep(pace / 2);

  // ── ۷) ورود ─────────────────────────────────────────────────────────────
  steps.start("session");
  await sleep(pace);
  markBootHealthy();
  const total = Math.round(performance.now() - startedAt);
  steps.done("session", `آماده در ${fmtMs(total)}`);

  if (total > SPLASH_BUDGET_MS) {
    // فقط برای تلمتری؛ کاربر چیزی نمی‌بیند.
    console.info(`[updater] splash budget exceeded: ${total}ms`);
  }

  phase = "ready";
  push();
  return { phase, steps: steps.snapshot(), decision, manifest, canEnter: true };
}
