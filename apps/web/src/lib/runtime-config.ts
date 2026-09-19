"use client";

import { UPDATE_PUBKEY, serverEndpoint } from "@/lib/config";

export interface RuntimeConfig {
  apiVersion: number;
  appVersion: string;
  updateChannel: string;
  updatePubkey: string;
  allowRegistration: boolean;
  requireInvite: boolean;
  voiceEnabled: boolean;
  voiceCapacity: number;
}

let cached: Promise<Partial<RuntimeConfig>> | null = null;

/**
 * پیکربندی زمان‌اجرا را یک‌بار می‌گیرد و کش می‌کند.
 * اگر در دسترس نبود، مقادیر بیلد به‌عنوان fallback می‌مانند — هیچ‌وقت throw نمی‌کند.
 */
export function getRuntimeConfig(): Promise<Partial<RuntimeConfig>> {
  cached ??= fetch(serverEndpoint("/api/config"), { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<RuntimeConfig>) : {}))
    .catch(() => ({}));
  return cached;
}

/**
 * کلید عمومی امضای آپدیت. اولویت با مقداری است که همین سرور اعلام می‌کند،
 * چون ایمیج آماده مقدار بیلد-تایم ندارد.
 */
export async function getUpdatePubkey(): Promise<string> {
  const cfg = await getRuntimeConfig();
  return cfg.updatePubkey || UPDATE_PUBKEY;
}
