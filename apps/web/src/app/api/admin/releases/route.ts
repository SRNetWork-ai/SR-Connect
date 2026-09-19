import { NextResponse } from "next/server";
import { one, q } from "@/lib/db/pool";
import { handle, HttpError, requirePermission } from "@/lib/auth/guard";
import { notify } from "@/lib/db/events";
import { listReleases, versionDistribution } from "@/server/release-store";
import { canSign } from "@/server/signing";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    await requirePermission("MANAGE_UPDATES");
    const [rows, distribution] = await Promise.all([listReleases(20), versionDistribution()]);
    // به شکل camelCase تا کلاینت بدون نقشه‌کشی اضافی مصرفش کند.
    const releases = rows.map((r) => ({
      version: r.version,
      channel: r.channel,
      mandatory: r.mandatory,
      rollout: r.rollout,
      yanked: Boolean(r.yanked),
      minClient: r.min_client,
      notes: r.notes ?? [],
      publishedAt: r.published_at,
      size: r.artifacts?.full?.size ?? null,
    }));
    return NextResponse.json({ releases, distribution, signingConfigured: canSign() });
  });
}

/** تغییر وضعیت یک ریلیز: اجباری‌کردن، درصد rollout، یا برگرداندن (yank). */
export function PATCH(req: Request) {
  return handle(async () => {
    const actor = await requirePermission("MANAGE_UPDATES");

    const body = (await req.json().catch(() => ({}))) as {
      version?: string;
      mandatory?: boolean;
      rollout?: number;
      yanked?: boolean;
    };
    if (!body.version) throw new HttpError(400, "نسخه لازم است");

    const rollout =
      body.rollout === undefined ? null : Math.max(0, Math.min(100, Math.round(body.rollout)));

    const release = await one<{ version: string; mandatory: boolean }>(
      `update releases set
         mandatory = coalesce($2, mandatory),
         rollout   = coalesce($3, rollout),
         yanked    = coalesce($4, yanked)
       where version = $1
       returning version, mandatory`,
      [body.version, body.mandatory ?? null, rollout, body.yanked ?? null],
    );
    if (!release) throw new HttpError(404, "این نسخه در مخزن ریلیز نیست");

    await q(
      `insert into audit_log (actor_id, action, target, meta) values ($1, 'release.update', $2, $3)`,
      [actor.id, release.version, JSON.stringify(body)],
    );
    await notify({ t: "release_published", version: release.version, mandatory: release.mandatory });

    return NextResponse.json({ release });
  });
}
