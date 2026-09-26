import { NextResponse } from "next/server";
import { one, q } from "@/lib/db/pool";
import { handle, HttpError, requirePermission } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    await requirePermission("MANAGE_ROLES");
    const bans = await q(
      `select b.user_id as "userId", u.username, u.display_name as "displayName",
              b.reason, b.created_at as "createdAt", a.display_name as "bannedBy"
         from server_bans b join users u on u.id = b.user_id
         left join users a on a.id = b.banned_by order by b.created_at desc`,
    );
    return NextResponse.json({ bans });
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const actor = await requirePermission("MANAGE_ROLES");
    const body = (await req.json().catch(() => ({}))) as { userId?: string; reason?: string };
    if (!body.userId || body.userId === actor.id)
      throw new HttpError(400, "این کاربر قابل بن نیست");
    const target = await one<{ isAdmin: boolean }>(
      `select is_admin as "isAdmin" from users where id = $1`,
      [body.userId],
    );
    if (!target) throw new HttpError(404, "کاربر پیدا نشد");
    if (target.isAdmin) throw new HttpError(403, "مدیر سرور قابل بن نیست");
    await q(
      `insert into server_bans (user_id, banned_by, reason) values ($1, $2, $3)
       on conflict (user_id) do update set banned_by = excluded.banned_by,
         reason = excluded.reason, created_at = now()`,
      [body.userId, actor.id, body.reason?.trim().slice(0, 300) || null],
    );
    await q(`delete from sessions where user_id = $1`, [body.userId]);
    return NextResponse.json({ ok: true }, { status: 201 });
  });
}

export function DELETE(req: Request) {
  return handle(async () => {
    await requirePermission("MANAGE_ROLES");
    const userId = new URL(req.url).searchParams.get("userId");
    if (!userId) throw new HttpError(400, "شناسه کاربر لازم است");
    await q(`delete from server_bans where user_id = $1`, [userId]);
    return new NextResponse(null, { status: 204 });
  });
}
