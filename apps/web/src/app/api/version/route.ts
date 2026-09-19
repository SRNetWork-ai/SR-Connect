import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { one } from "@/lib/db/pool";
import { serverEnv } from "@/lib/env";
import { APP_VERSION, type UpdateChannel } from "@/lib/config";
import { currentUser } from "@/lib/auth/session";
import { buildManifest, recordClientVersion, type ForceState } from "@/server/release-store";

export const dynamic = "force-dynamic";

const CHANNELS: UpdateChannel[] = ["stable", "beta", "nightly"];
const FORCES: ForceState[] = [
  "default",
  "uptodate",
  "optional",
  "mandatory",
  "minclient",
  "apibump",
  "rollout",
];

/**
 * مانیفست نسخه — قلب سیستم آپدیت.
 *  ?channel=stable|beta|nightly
 *  ?client=1.0.0     نسخه‌ی فعلی کلاینت (برای ساخت دلتا)
 *  ?device=…         شناسه‌ی دستگاه برای rollout پله‌ای و آمار
 *  ?platform=web|pwa|tauri|android|ios
 *  ?force=…          فقط تست: حالت‌های مختلف اسپلش
 *  ?delay=1200       فقط تست: تأخیر مصنوعی سرور
 */
export async function GET(req: Request) {
  const url = new URL(req.url);

  const delay = Math.min(Number(url.searchParams.get("delay") ?? 0) || 0, 10_000);
  if (delay) await new Promise((r) => setTimeout(r, delay));

  const channelParam = url.searchParams.get("channel") as UpdateChannel | null;
  const channel = channelParam && CHANNELS.includes(channelParam) ? channelParam : "stable";

  const forceParam = url.searchParams.get("force") as ForceState | null;
  const force = forceParam && FORCES.includes(forceParam) ? forceParam : "default";

  const clientVersion = url.searchParams.get("client") ?? APP_VERSION;
  const deviceId = url.searchParams.get("device");
  const platform = url.searchParams.get("platform") ?? "web";

  // آمار زنده‌ی سرور برای ردیف پایین اسپلش
  let stats;
  try {
    const row = await one<{ online: number; voice: number }>(
      `select count(*) filter (where status <> 'offline')::int as online, 0::int as voice
         from users`,
    );
    stats = {
      health: "ok" as const,
      region: process.env.SERVER_REGION ?? "self-hosted",
      latencyMs: 0,
      voiceSlots: { used: row?.voice ?? 0, total: serverEnv.voiceCapacity },
    };
  } catch {
    stats = undefined;
  }

  const manifest = await buildManifest({ channel, clientVersion, force, stats });

  const user = await currentUser().catch(() => null);
  void recordClientVersion({
    deviceId,
    version: clientVersion,
    platform,
    channel,
    userId: user?.id ?? null,
  });

  const etag = `"${createHash("sha1").update(JSON.stringify(manifest)).digest("hex").slice(0, 16)}"`;

  return NextResponse.json(manifest, {
    headers: {
      "cache-control": "no-store, max-age=0",
      etag,
      "x-sr-latest": manifest.latest,
      "x-sr-api-version": String(manifest.apiVersion),
    },
  });
}
