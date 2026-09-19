import { APP_VERSION, CLIENT_API_VERSION } from "@/lib/config";
import { shouldRollback } from "./crash-guard";
import { isInRollout } from "./rollout";
import { gt, lt } from "./semver";
import type { UpdateDecision, VersionManifest } from "./types";

export interface DecideInput {
  manifest: VersionManifest;
  current?: string;
  /** اگر کاربر وسط تماس صوتی است، نصب هیچ‌وقت انجام نمی‌شود. */
  inCall?: boolean;
}

/**
 * تنها جای تصمیم‌گیری. هم اسپلش و هم «مرکز آپدیت» از همین تابع استفاده می‌کنند
 * تا رفتار دو جا از هم واگرا نشود.
 *
 * ترتیب اولویت:
 *   ۱) رول‌بک بعد از کرش‌های پشت‌سرهم
 *   ۲) ناسازگاری نسخه‌ی API   ⇒ اجباری
 *   ۳) پایین‌تر از minClient   ⇒ اجباری
 *   ۴) پرچم mandatory سرور     ⇒ اجباری
 *   ۵) وسط تماس صوتی           ⇒ تعویق
 *   ۶) بیرون از سطل rollout    ⇒ تعویق
 *   ۷) نسخه‌ی جدید موجود       ⇒ اختیاری
 */
export function decide({ manifest, current = APP_VERSION, inCall }: DecideInput): UpdateDecision {
  const rb = shouldRollback();
  if (rb.rollback && rb.to) {
    return { kind: "rollback", target: rb.to, crashes: rb.crashes };
  }

  const artifact =
    manifest.artifacts.delta && manifest.artifacts.delta.from === current
      ? manifest.artifacts.delta
      : manifest.artifacts.full;

  const behind = gt(manifest.latest, current);

  if (manifest.apiVersion > CLIENT_API_VERSION) {
    return { kind: "mandatory", target: manifest.latest, artifact, reason: "api-version" };
  }
  if (lt(current, manifest.minClient)) {
    return { kind: "mandatory", target: manifest.latest, artifact, reason: "min-client" };
  }
  if (manifest.mandatory && behind) {
    return { kind: "mandatory", target: manifest.latest, artifact, reason: "flagged" };
  }

  if (!behind) return { kind: "up-to-date", current };

  if (inCall) return { kind: "deferred", target: manifest.latest, reason: "in-call" };

  if (!isInRollout(manifest.latest, manifest.rollout)) {
    return { kind: "deferred", target: manifest.latest, reason: "rollout-held" };
  }

  return { kind: "optional", target: manifest.latest, artifact };
}

/** آیا این تصمیم باید همین حالا و قبل از باز شدن اپ نصب شود؟ */
export function blocksEntry(d: UpdateDecision): boolean {
  return d.kind === "mandatory" || d.kind === "rollback";
}

export const DECISION_LABEL: Record<UpdateDecision["kind"], string> = {
  "up-to-date": "به‌روز هستید",
  optional: "به‌روزرسانی موجود است",
  mandatory: "به‌روزرسانی اجباری",
  rollback: "بازگشت به نسخه‌ی سالم",
  deferred: "به‌روزرسانی به تعویق افتاد",
  offline: "سرور در دسترس نیست",
};

export const MANDATORY_REASON_LABEL = {
  flagged: "ادمین این نسخه را اجباری کرده است",
  "min-client": "نسخه‌ی کلاینت شما پایین‌تر از حد مجاز سرور است",
  "api-version": "قرارداد API سرور جلوتر رفته و این نسخه دیگر وصل نمی‌شود",
} as const;

export const DEFER_REASON_LABEL = {
  "in-call": "وسط تماس صوتی هستید؛ نصب بعد از قطع تماس انجام می‌شود",
  "rollout-held": "این نسخه پله‌ای منتشر می‌شود و نوبت دستگاه شما نرسیده",
  "same-version": "نسخه‌ای جدیدتر از نسخه‌ی فعلی وجود ندارد",
} as const;
