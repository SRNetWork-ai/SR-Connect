import { NextResponse } from "next/server";
import { one, q } from "@/lib/db/pool";
import { handle, HttpError, requireUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export function PATCH(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const friendship = await one(
      `update friendships
          set status = 'accepted', accepted_at = now()
        where id = $1 and status = 'pending' and requested_by <> $2
          and (user_low = $2 or user_high = $2)
        returning id, status`,
      [id, user.id],
    );
    if (!friendship) throw new HttpError(404, "درخواست دوستی پیدا نشد");
    return NextResponse.json({ friendship });
  });
}

export function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const rows = await q(
      `delete from friendships
        where id = $1 and (user_low = $2 or user_high = $2)
        returning id`,
      [id, user.id],
    );
    if (!rows.length) throw new HttpError(404, "رابطه‌ی دوستی پیدا نشد");
    return new NextResponse(null, { status: 204 });
  });
}
