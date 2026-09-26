import { NextResponse } from "next/server";
import { LIMITS } from "@sr/protocol";
import { one, q } from "@/lib/db/pool";
import { handle, HttpError, requireUser } from "@/lib/auth/guard";
import { rateLimit, RATE } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

async function requireDirectAccess(userId: string, peerId: string) {
  const preference = await one<{ allowDmFrom: string }>(
    `select coalesce(p.allow_dm_from, 'friends') as "allowDmFrom"
       from users u left join user_preferences p on p.user_id = u.id
      where u.id = $1`,
    [peerId],
  );
  if (!preference) throw new HttpError(404, "کاربر پیدا نشد");
  if (preference.allowDmFrom === "nobody") {
    throw new HttpError(403, "این کاربر پیام خصوصی را بسته است");
  }
  if (preference.allowDmFrom === "everyone") return;
  const friendship = await one(
    `select id from friendships
      where user_low = least($1::uuid, $2::uuid)
        and user_high = greatest($1::uuid, $2::uuid)
        and status = 'accepted'`,
    [userId, peerId],
  );
  if (!friendship) throw new HttpError(403, "این کاربر فقط از دوستان پیام می‌گیرد");
}

async function conversation(userId: string, peerId: string, create: boolean) {
  const found = await one<{ id: string }>(
    `select id from direct_conversations
      where user_low = least($1::uuid, $2::uuid)
        and user_high = greatest($1::uuid, $2::uuid)`,
    [userId, peerId],
  );
  if (found || !create) return found;
  return one<{ id: string }>(
    `insert into direct_conversations (user_low, user_high)
     values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid))
     on conflict (user_low, user_high) do update set user_low = excluded.user_low
     returning id`,
    [userId, peerId],
  );
}

export function GET(req: Request, ctx: { params: Promise<{ userId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { userId } = await ctx.params;
    await requireDirectAccess(user.id, userId);
    const conv = await conversation(user.id, userId, false);
    if (!conv) return NextResponse.json({ messages: [] });

    const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 100) || 100, 100);
    const messages = await q(
      `select dm.id, dm.content, dm.created_at as "createdAt",
              dm.edited_at as "editedAt",
              json_build_object(
                'id', u.id, 'username', u.username, 'displayName', u.display_name,
                'avatarColor', u.avatar_color, 'avatarUrl', u.avatar_url
              ) as author
         from direct_messages dm
         join users u on u.id = dm.author_id
        where dm.conversation_id = $1 and dm.deleted_at is null
        order by dm.created_at desc, dm.id desc
        limit $2`,
      [conv.id, limit],
    );
    return NextResponse.json({ messages: messages.reverse() });
  });
}

export function POST(req: Request, ctx: { params: Promise<{ userId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { userId } = await ctx.params;
    await requireDirectAccess(user.id, userId);
    const limited = rateLimit(`dm:${user.id}`, RATE.message.limit, RATE.message.windowMs);
    if (!limited.ok) throw new HttpError(429, "کمی آرام‌تر؛ تعداد پیام زیاد شد");
    const body = (await req.json().catch(() => ({}))) as { content?: string };
    const content = (body.content ?? "").trim();
    if (!content) throw new HttpError(400, "پیام خالی است");
    if (content.length > LIMITS.messageLength) {
      throw new HttpError(400, `حداکثر ${LIMITS.messageLength} نویسه`);
    }

    const conv = await conversation(user.id, userId, true);
    const message = await one(
      `with inserted as (
         insert into direct_messages (conversation_id, author_id, content)
         values ($1, $2, $3)
         returning *
       )
       select dm.id, dm.content, dm.created_at as "createdAt", dm.edited_at as "editedAt",
              json_build_object(
                'id', u.id, 'username', u.username, 'displayName', u.display_name,
                'avatarColor', u.avatar_color, 'avatarUrl', u.avatar_url
              ) as author
         from inserted dm join users u on u.id = dm.author_id`,
      [conv!.id, user.id, content],
    );
    return NextResponse.json({ message }, { status: 201 });
  });
}
