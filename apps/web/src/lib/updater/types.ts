import type { UpdateChannel } from "@/lib/config";

/** یک آرتیفکت قابل دانلود (بسته‌ی کامل یا دلتا). */
export interface Artifact {
  url: string;
  size: number;
  /** هش SHA-256 به hex */
  sha256: string;
  /** امضای Ed25519 روی هشِ بالا، base64 */
  sig: string;
  /** اگر دلتا باشد، نسخه‌ی مبدأ */
  from?: string;
}

export interface VersionManifest {
  /** آخرین نسخه‌ی منتشرشده در این کانال */
  latest: string;
  /** کلاینت پایین‌تر از این نسخه اجازه‌ی اتصال ندارد */
  minClient: string;
  /** نسخه‌ی قرارداد API سرور */
  apiVersion: number;
  channel: UpdateChannel;
  /** آپدیت اجباری اعلام‌شده توسط ادمین */
  mandatory: boolean;
  /** انتشار پله‌ای: درصد کاربرانی که این نسخه را می‌گیرند (۰..۱۰۰) */
  rollout: number;
  publishedAt: string;
  notes: string[];
  artifacts: {
    full: Artifact;
    delta?: Artifact;
  };
  server: {
    health: "ok" | "degraded" | "down";
    region: string;
    /** میانگین تأخیر SFU به میلی‌ثانیه */
    latencyMs: number;
    /** ظرفیت باقی‌مانده‌ی اتاق‌های صوتی */
    voiceSlots: { used: number; total: number };
  };
}

export type MandatoryReason = "flagged" | "min-client" | "api-version";
export type DeferReason = "in-call" | "rollout-held" | "same-version";

export type UpdateDecision =
  | { kind: "up-to-date"; current: string }
  | { kind: "optional"; target: string; artifact: Artifact }
  | { kind: "mandatory"; target: string; artifact: Artifact; reason: MandatoryReason }
  | { kind: "rollback"; target: string; crashes: number }
  | { kind: "deferred"; target: string; reason: DeferReason }
  | { kind: "offline"; error: string; cachedVersion: string };

/** مرحله‌های اسپلش، به همان ترتیبی که به کاربر نشان داده می‌شوند. */
export type StepId = "connect" | "check" | "download" | "verify" | "install" | "session";

export type StepStatus = "idle" | "active" | "done" | "skipped" | "failed";

export interface StepState {
  id: StepId;
  status: StepStatus;
  /** ۰..۱ — فقط برای مرحله‌ی دانلود پر می‌شود */
  progress?: number;
  detail?: string;
  durationMs?: number;
}

export type FlowPhase = "running" | "ready" | "blocked" | "failed";

export interface FlowState {
  phase: FlowPhase;
  steps: StepState[];
  decision?: UpdateDecision;
  manifest?: VersionManifest;
  error?: string;
  /** وقتی true شد اپ می‌تواند باز شود */
  canEnter: boolean;
}
