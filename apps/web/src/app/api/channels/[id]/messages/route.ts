import { NextResponse } from "next/server";
import { LIMITS } from "@sr/protocol";
import { one, q } from "@/lib/db/pool";
import { handle, HttpError, requireChannelPermission } from "@/lib/auth/guard";
import { notify } from "@/lib/db/events";
import { loadMessage, messageQuery } from "@/lib/db/messages";
import { rateLimit, RATE } from "@/lib/rate-limit";
import { mentionIds } from "@/lib/markdown-parse";

export const dynamic = "force-dynamic";

/** تاریخچه — صفحه‌بندی با keyset روی created_at تا با رشد جدول کند نشود. */
export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = await requireChannelPermission(id, "VIEW_CHANNEL");

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 100);
    const before = url.searchParams.get("before");

    const rows = await q(
      messageQuery(
        `where m.channel_id = $2 and m.deleted_at is null
           and ($3::timestamptz is null or m.created_at < $3::timestamptz)
         order by m.created_at desc, m.id desc
         limit $4`,
      ),
      [user.id, id, before, limit],
    );

    return NextResponse.json({ messages: rows.reverse(), hasMore: rows.length === limit });
  });
}

export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = await requireChannelPermission(id, "SEND_MESSAGE");

    const limited = rateLimit(`msg:${user.id}`, RATE.message.limit, RATE.message.windowMs);
    if (!limited.ok) throw new HttpError(429, "کمی آرام‌تر؛ تعداد پیام در دقیقه زیاد شد");

    const body = (await req.json().catch(() => ({}))) as {
      content?: string;
      replyTo?: string | null;
      attachmentIds?: string[];
    };
    const content = (body.content ?? "").trim();
    const attachmentIds = (body.attachmentIds ?? []).slice(0, LIMITS.attachmentsPerMessage);

    if (!content && attachmentIds.length === 0) throw new HttpError(400, "پیام خالی است");
    if (content.length > LIMITS.messageLength) {
      throw new HttpError(400, `حداکثر ${LIMITS.messageLength} نویسه`);
    }
    if (attachmentIds.length > 0) {
      await requireChannelPermission(id, "ATTACH_FILES");
    }

    const inserted = await one<{ id: string }>(
      `insert into messages (channel_id, author_id, content, reply_to)
       values ($1, $2, $3, $4) returning id`,
      [id, user.id, content, body.replyTo ?? null],
    );
    const messageId = inserted!.id;

    // پیوست‌ها قبلاً آپلود شده‌اند و بدون پیام رها بودند؛ حالا وصلشان می‌کنیم.
    if (attachmentIds.length > 0) {
      await q(
        `update attachments set message_id = $1
          where id = any($2::uuid[]) and message_id is null`,
        [messageId, attachmentIds],
      );
    }

    const mentioned = mentionIds(content);
    if (mentioned.length > 0) {
      await q(
        `insert into mentions (message_id, user_id, channel_id)
         select $1, u.id, $2 from users u where u.id = any($3::uuid[]) and u.id <> $4
         on conflict do nothing`,
        [messageId, id, mentioned, user.id],
      ).catch(() => undefined);
    }

    const message = await loadMessage(user.id, messageId);
    await notify({ t: "message_create", messageId, channelId: id });

    return NextResponse.json({ message }, { status: 201 });
  });
}
