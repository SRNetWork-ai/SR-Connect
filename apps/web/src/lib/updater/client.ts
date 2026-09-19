import {
  APP_VERSION,
  UPDATE_CHANNEL,
  VERSION_CHECK_TIMEOUT_MS,
  serverEndpoint,
} from "@/lib/config";
import { deviceId } from "./rollout";
import type { VersionManifest } from "./types";

export class VersionCheckError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "VersionCheckError";
  }
}

function assertManifest(data: unknown): VersionManifest {
  const d = data as Partial<VersionManifest>;
  if (
    !d ||
    typeof d.latest !== "string" ||
    typeof d.minClient !== "string" ||
    typeof d.apiVersion !== "number" ||
    !d.artifacts?.full?.url
  ) {
    throw new VersionCheckError("پاسخ سرور ساختار معتبری ندارد");
  }
  return d as VersionManifest;
}

/**
 * قانون طلایی: این درخواست هرگز بیشتر از VERSION_CHECK_TIMEOUT_MS
 * اپ را نگه نمی‌دارد. هر خطایی یعنی «آفلاین» و اپ با نسخه‌ی فعلی باز می‌شود.
 */
export async function fetchManifest(
  signal?: AbortSignal,
  timeoutMs = VERSION_CHECK_TIMEOUT_MS,
): Promise<VersionManifest> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error("timeout")), timeoutMs);
  signal?.addEventListener("abort", () => ctrl.abort(signal.reason), { once: true });

  const params = new URLSearchParams({
    channel: UPDATE_CHANNEL,
    device: deviceId(),
    client: APP_VERSION,
  });

  // کمک‌حال تست: ?force=mandatory | uptodate | rollout | apibump … را به سرور پاس می‌دهد
  // تا بتوان همه‌ی حالت‌های اسپلش را بدون دست‌کاری سرور دید.
  if (typeof location !== "undefined") {
    const force = new URLSearchParams(location.search).get("force");
    if (force) params.set("force", force);
  }

  const url = `${serverEndpoint("/api/version")}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new VersionCheckError(`سرور کد ${res.status} برگرداند`);
    return assertManifest(await res.json());
  } catch (err) {
    if (err instanceof VersionCheckError) throw err;
    const aborted = (err as Error)?.name === "AbortError";
    throw new VersionCheckError(
      aborted ? `سرور در ${timeoutMs} میلی‌ثانیه پاسخ نداد` : "اتصال به سرور برقرار نشد",
      { cause: err },
    );
  } finally {
    clearTimeout(timer);
  }
}
