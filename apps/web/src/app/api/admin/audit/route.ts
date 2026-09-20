import { NextResponse } from "next/server";
import { q } from "@/lib/db/pool";
import { handle, requirePermission } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** آخرین رویدادهای مدیریتی. فقط برای کسی که MANAGE_ROLES دارد. */
export function GET(req: Request) {
  return handle(async () => {
    await requirePermission("MANAGE_ROLES");
    const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 60) || 60, 200);

    const entries = await q(
      `select a.id::text as id, a.action, a.target, a.meta,
              a.created_at as "createdAt",
              coalesce(u.display_name, 'سیستم') as "actorName"
         from audit_log a
         left join users u on u.id = a.actor_id
        order by a.created_at desc
        limit $1`,
      [limit],
    );
    return NextResponse.json({ entries });
  });
}
