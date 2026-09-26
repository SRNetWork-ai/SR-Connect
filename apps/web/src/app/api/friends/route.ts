import { NextResponse } from "next/server";
import { one, q } from "@/lib/db/pool";
import { handle, HttpError, requireUser } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const FRIEND_SELECT = `
  select f.id, f.status,
         case when f.requested_by = $1 then 'outgoing' else 'incoming' end as direction,
         json_build_object(
           'id', u.id, 'username', u.username, 'displayName', u.display_name,
           'avatarColor', u.avatar_color, 'avatarUrl', u.avatar_url, 'bio', u.bio,
           'status', u.status, 'isAdmin', u.is_admin, 'roles', '[]'::json
         ) as user
    from friendships f
    join users u on u.id = case when f.user_low = $1 then f.user_high else f.user_low end
   where f.user_low = $1 or f.user_high = $1
   order by case when f.status = 'pending' then 0 else 1 end, u.display_name`;

export function GET() {
  return handle(async () => {
    const user = await requireUser();
    const friendships = await q(FRIEND_SELECT, [user.id]);
    return NextResponse.json({ friendships });
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const limited = rateLimit(`friend:${user.id}`, 12, 60_000);
    if (!limited.ok) throw new HttpError(429, "درخواست‌های دوستی زیادی فرستادی");

    const body = (await req.json().catch(() => ({}))) as { username?: string };
    const username = (body.username ?? "").trim().replace(/^@/, "");
    if (!username) throw new HttpError(400, "نام کاربری را وارد کن");

    const target = await one<{ id: string }>(
      `select id from users where username = $1 and id <> $2`,
      [username, user.id],
    );
    if (!target) throw new HttpError(404, "کاربری با این نام پیدا نشد");

    const existing = await one<{ id: string; status: string; requestedBy: string }>(
      `select id, status, requested_by as "requestedBy"
         from friendships
        where user_low = least($1::uuid, $2::uuid)
          and user_high = greatest($1::uuid, $2::uuid)`,
      [user.id, target.id],
    );
    if (existing?.status === "accepted") throw new HttpError(409, "این کاربر از قبل دوست تو است");
    if (existing) throw new HttpError(409, "درخواست دوستی از قبل وجود دارد");

    const friendship = await one(
      `insert into friendships (user_low, user_high, requested_by)
       values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid), $1)
       returning id, status`,
      [user.id, target.id],
    );
    return NextResponse.json({ friendship }, { status: 201 });
  });
}
