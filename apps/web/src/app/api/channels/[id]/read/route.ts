import { NextResponse } from "next/server";
import { q } from "@/lib/db/pool";
import { handle, requireChannelPermission } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** علامت‌گذاری کانال به‌عنوان خوانده‌شده تا اینجا. */
export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = await requireChannelPermission(id, "VIEW_CHANNEL");
    const body = (await req.json().catch(() => ({}))) as { messageId?: string };

    await q(
      `insert into read_state (user_id, channel_id, last_read_at, last_read_id, updated_at)
       values ($1, $2, now(), $3, now())
       on conflict (user_id, channel_id) do update
         set last_read_at = now(), last_read_id = excluded.last_read_id, updated_at = now()`,
      [user.id, id, body.messageId ?? null],
    );
    // منشن‌های خوانده‌شده پاک می‌شوند تا نشان قرمز برگردد به صفر.
    await q(`delete from mentions where user_id = $1 and channel_id = $2`, [user.id, id]);

    return NextResponse.json({ ok: true });
  });
}
