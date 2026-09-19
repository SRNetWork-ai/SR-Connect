import { createHash } from "node:crypto";
import { q } from "@/lib/db/pool";
import { serverEnv } from "@/lib/env";
import type { UpdateChannel } from "@/lib/config";
import type { Artifact, VersionManifest } from "@/lib/updater/types";
import { DEV_DELTA_RATIO, DEV_FULL_SIZE, devBytes } from "./dev-artifacts";
import { signHash } from "./signing";

export type ForceState =
  | "default"
  | "uptodate"
  | "optional"
  | "mandatory"
  | "minclient"
  | "apibump"
  | "rollout";

export interface ReleaseRow {
  version: string;
  channel: UpdateChannel;
  min_client: string;
  api_version: number;
  mandatory: boolean;
  rollout: number;
  notes: string[];
  artifacts: { full?: Artifact; delta?: Record<string, Artifact> };
  published_at: string;
  yanked?: boolean;
}

/* ── ریلیزهای واقعی از دیتابیس ─────────────────────────────────────────── */

export async function latestRelease(channel: UpdateChannel): Promise<ReleaseRow | null> {
  const rows = await q<ReleaseRow>(
    `select version, channel, min_client, api_version, mandatory, rollout,
            notes, artifacts, published_at, yanked
       from releases
      where channel = $1 and not yanked and published_at is not null
      order by published_at desc
      limit 1`,
    [channel],
  ).catch(() => [] as ReleaseRow[]);
  return rows[0] ?? null;
}

export async function listReleases(limit = 20): Promise<ReleaseRow[]> {
  return q<ReleaseRow>(
    `select version, channel, min_client, api_version, mandatory, rollout,
            notes, artifacts, published_at, yanked
       from releases
      order by published_at desc nulls last
      limit $1`,
    [limit],
  ).catch(() => [] as ReleaseRow[]);
}

/* ── نسخه‌ی توسعه: ریلیز ساختگی وقتی دیتابیس خالی است ──────────────────── */

const DEV_LATEST = "1.0.0";
const DEV_NOTES = [
  "اولین نسخه‌ی پایدار SR-Connect روی سرور شخصی",
  "چت زنده، کانال صوتی روی LiveKit و مرکز آپدیت امضاشده",
];

function devArtifact(version: string, from?: string): Artifact {
  const size = from ? Math.round(DEV_FULL_SIZE * DEV_DELTA_RATIO) : DEV_FULL_SIZE;
  const seed = from ? `sr-connect:delta:${from}->${version}` : `sr-connect:full:${version}`;
  const sha = createHash("sha256").update(devBytes(seed, size)).digest("hex");
  const name = from
    ? `sr-connect-${version}-delta-from-${from}.bin`
    : `sr-connect-${version}-full.bin`;
  return { url: `/api/artifact/${name}`, size, sha256: sha, sig: signHash(sha), from };
}

/* ── ساخت مانیفست ──────────────────────────────────────────────────────── */

export async function buildManifest(opts: {
  channel: UpdateChannel;
  clientVersion: string;
  force?: ForceState;
  stats?: VersionManifest["server"];
}): Promise<VersionManifest> {
  const { channel, clientVersion, force = "default" } = opts;
  const row = await latestRelease(channel);

  let latest = row?.version ?? DEV_LATEST;
  let mandatory = row?.mandatory ?? false;
  let minClient = row?.min_client ?? "0.0.0";
  let apiVersion = row?.api_version ?? 3;
  let rollout = row?.rollout ?? 100;
  const notes = row?.notes ?? DEV_NOTES;
  const publishedAt = row?.published_at ?? new Date().toISOString();

  // حالت‌های تست — فقط برای دیدن رفتار اسپلش، داده‌ی واقعی را عوض نمی‌کنند.
  switch (force) {
    case "uptodate":
      latest = clientVersion;
      break;
    case "optional":
      mandatory = false;
      rollout = 100;
      break;
    case "mandatory":
      mandatory = true;
      rollout = 100;
      break;
    case "minclient":
      minClient = latest;
      break;
    case "apibump":
      apiVersion = 99;
      break;
    case "rollout":
      rollout = 1;
      break;
  }

  const full = row?.artifacts?.full ?? devArtifact(latest);
  const delta =
    latest === clientVersion
      ? undefined
      : (row?.artifacts?.delta?.[clientVersion] ?? (row ? undefined : devArtifact(latest, clientVersion)));

  return {
    latest,
    minClient,
    apiVersion,
    channel,
    mandatory,
    rollout,
    publishedAt,
    notes,
    artifacts: { full, delta },
    server: opts.stats ?? {
      health: "ok",
      region: process.env.SERVER_REGION ?? "self-hosted",
      latencyMs: 0,
      voiceSlots: { used: 0, total: serverEnv.voiceCapacity },
    },
  };
}

/* ── تله‌متری حداقلی نسخه‌ها ────────────────────────────────────────────── */

export async function recordClientVersion(input: {
  deviceId: string | null;
  version: string;
  platform: string;
  channel: string;
  userId: string | null;
}): Promise<void> {
  if (!input.deviceId) return;
  await q(
    `insert into client_versions (device_id, user_id, version, platform, channel, last_seen_at)
     values ($1, $2, $3, $4, $5, now())
     on conflict (device_id) do update set
       user_id = excluded.user_id,
       version = excluded.version,
       platform = excluded.platform,
       channel = excluded.channel,
       last_seen_at = now()`,
    [input.deviceId.slice(0, 64), input.userId, input.version, input.platform, input.channel],
  ).catch(() => {});
}

export async function versionDistribution(): Promise<{ version: string; devices: number }[]> {
  return q<{ version: string; devices: number }>(
    `select version, count(*)::int as devices
       from client_versions
      where last_seen_at > now() - interval '30 days'
      group by version
      order by devices desc
      limit 10`,
  ).catch(() => []);
}
