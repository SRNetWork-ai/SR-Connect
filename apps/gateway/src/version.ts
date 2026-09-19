import { q } from "./db.js";
import { env } from "./env.js";

export interface VersionInfo {
  latest: string;
  minClient: string;
  mandatory: boolean;
}

let cache: VersionInfo = {
  latest: env.latestVersion,
  minClient: env.minClientVersion,
  mandatory: env.mandatoryUpdate,
};

export function currentVersion(): VersionInfo {
  return cache;
}

/** آخرین انتشار را از همان جدولی می‌خواند که اپ وب می‌نویسد. */
export async function refreshVersion(): Promise<VersionInfo> {
  try {
    const rows = await q<{ version: string; min_client: string | null; mandatory: boolean }>(
      `select version, min_client, mandatory
         from releases
        where published_at is not null and not yanked
        order by published_at desc
        limit 1`,
    );
    const row = rows[0];
    if (row) {
      cache = {
        latest: row.version,
        minClient: row.min_client || env.minClientVersion,
        mandatory: row.mandatory,
      };
    }
  } catch {
    /* هنوز migration اجرا نشده یا دیتابیس بالا نیامده */
  }
  return cache;
}

export function compareSemver(a: string, b: string): number {
  const parse = (v: string) => {
    const [core = "0.0.0"] = v.split("+");
    const [nums = "0.0.0", pre] = core.split("-");
    return { parts: nums.split(".").map((n) => Number.parseInt(n, 10) || 0), pre };
  };
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i += 1) {
    const d = (pa.parts[i] ?? 0) - (pb.parts[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  if (pa.pre && !pb.pre) return -1;
  if (!pa.pre && pb.pre) return 1;
  if (pa.pre && pb.pre) return pa.pre === pb.pre ? 0 : pa.pre < pb.pre ? -1 : 1;
  return 0;
}
