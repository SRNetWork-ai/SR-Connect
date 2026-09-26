import { NextResponse } from "next/server";
import { one, q } from "@/lib/db/pool";
import { handle, HttpError, requirePermission, requireUser } from "@/lib/auth/guard";
import { rateLimit, RATE } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const TARGETS = ["server", "user", "message"] as const;

/** ثبت گزارش توسط هر عضو. */
export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const limited = rateLimit(`report:${user.id}`, 5, 60 * 60_000);
    if (!limited.ok) throw new HttpError(429, "در هر ساعت حداکثر ۵ گزارش");

    const body = (await req.json().catch(() => ({}))) as {
      targetType?: string;
      targetId?: string;
      reason?: string;
    };
    const targetType = (body.targetType ?? "server") as (typeof TARGETS)[number];
    if (!TARGETS.includes(targetType)) throw new HttpError(400, "نوع گزارش نامعتبر است");
    const reason = (body.reason ?? "").trim();
    if (reason.length < 5) throw new HttpError(400, "دلیل گزارش را کامل‌تر بنویس");

    const row = await one<{ id: string }>(
      `insert into reports (reporter_id, target_type, target_id, reason)
       values ($1, $2, $3, $4) returning id`,
      [user.id, targetType, body.targetId ?? null, reason.slice(0, 1000)],
    );
    return NextResponse.json({ report: { id: row!.id } }, { status: 201 });
  });
}

/** فهرست گزارش‌ها برای مدیریت. */
export function GET() {
  return handle(async () => {
    await requirePermission("MANAGE_ROLES");
    const reports = await q(
      `select r.id, r.target_type as "targetType", r.target_id as "targetId", r.reason,
              r.status, r.created_at as "createdAt", u.display_name as "reporter"
         from reports r
         left join users u on u.id = r.reporter_id
        order by r.created_at desc limit 100`,
    );
    return NextResponse.json({ reports });
  });
}

export function PATCH(req: Request) {
  return handle(async () => {
    await requirePermission("MANAGE_ROLES");
    const body = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
    if (!body.id || !["reviewed", "dismissed", "open"].includes(body.status ?? "")) {
      throw new HttpError(400, "درخواست نامعتبر است");
    }
    await q(`update reports set status = $2 where id = $1`, [body.id, body.status]);
    return NextResponse.json({ ok: true });
  });
}
