import { NextResponse } from "next/server";
import { LIMITS } from "@sr/protocol";
import { one, q } from "@/lib/db/pool";
import { handle, HttpError, requireChannelPermission } from "@/lib/auth/guard";
import { notify } from "@/lib/db/events";

export const dynamic = "force-dynamic";

const MESSAGE_SELECT = `
  select m.id, m.channel_id as "channelId", m.content, m.system,
         m.reply_to as "replyTo", m.created_at as "createdAt", m.edited_at as "editedAt",
         json_build_object(
           'id', coalesce(u.id::text, 'system'),
           'username', coalesce(u.username, 'system'),
           'displayName', coalesce(u.display_name, 'SR-Connect'),
           'avatarColor', coalesce(u.avatar_color, '#5865F2')
         ) as author
    from messages m
    left join users u on u.id = m.author_id`;

/** تاریخچه — صفحه‌بندی با keyset روی created_at تا با رشد جدول کند نشود. */
export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    await requireChannelPermission(id, "VIEW_CHANNEL");

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 100);
    const before = url.searchParams.get("before");

    const rows = await q(
      `${MESSAGE_SELECT}
        where m.channel_id = $1 and m.deleted_at is null
          and ($2::timestamptz is null or m.created_at < $2::timestamptz)
        order by m.created_at desc, m.id desc
        limit $3`,
      [id, before, limit],
    );

    return NextResponse.json({ messages: rows.reverse(), hasMore: rows.length === limit });
  });
}

export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = await requireChannelPermission(id, "SEND_MESSAGE");

    const body = (await req.json().catch(() => ({}))) as {
      content?: string;
      replyTo?: string | null;
    };
    const content = (body.content ?? "").trim();
    if (!content) throw new HttpError(400, "متن پیام خالی است");
    if (content.length > LIMITS.messageLength) {
      throw new HttpError(400, `حداکثر ${LIMITS.messageLength} نویسه`);
    }

    // نرده‌ی سرعت: بیش از حد مجاز در دقیقه‌ی گذشته؟
    const recent = await one<{ n: number }>(
      `select count(*)::int as n from messages
        where author_id = $1 and created_at > now() - interval '1 minute'`,
      [user.id],
    );
    if ((recent?.n ?? 0) >= LIMITS.messagesPerMinute) {
      throw new HttpError(429, "کمی آرام‌تر؛ تعداد پیام در دقیقه زیاد شد");
    }

    const inserted = await one<{ id: string }>(
      `insert into messages (channel_id, author_id, content, reply_to)
       values ($1, $2, $3, $4) returning id`,
      [id, user.id, content, body.replyTo ?? null],
    );

    const message = await one(`${MESSAGE_SELECT} where m.id = $1`, [inserted!.id]);
    await notify({ t: "message_create", messageId: inserted!.id, channelId: id });

    return NextResponse.json({ message }, { status: 201 });
  });
}
