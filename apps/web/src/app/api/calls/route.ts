import { NextResponse } from "next/server";
import { q } from "@/lib/db/pool";
import { handle, requireUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** تماس‌های ورودیِ در حال زنگ خوردن برای کاربر فعلی. */
export function GET() {
  return handle(async () => {
    const user = await requireUser();
    await q(
      `update direct_calls set status = 'missed', ended_at = now()
        where status = 'ringing' and created_at < now() - interval '45 seconds'`,
    );
    const calls = await q(
      `select c.id, c.video, c.status, c.created_at as "createdAt",
              json_build_object(
                'id', u.id, 'username', u.username, 'displayName', u.display_name,
                'avatarColor', u.avatar_color, 'avatarUrl', u.avatar_url
              ) as caller
         from direct_calls c
         join users u on u.id = c.caller_id
        where c.callee_id = $1 and c.status = 'ringing'
        order by c.created_at desc
        limit 3`,
      [user.id],
    );
    return NextResponse.json({ calls });
  });
}
