import { NextResponse } from "next/server";
import { has, LIMITS } from "@sr/protocol";
import { one, q } from "@/lib/db/pool";
import { channelPermissions, handle, HttpError, requireChannelPermission } from "@/lib/auth/guard";
import { notify } from "@/lib/db/events";
import { loadMessage } from "@/lib/db/messages";
import { rateLimit, RATE } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; messageId: string }> };

async function ownRow(messageId: string, channelId: string) {
  const row = await one<{ author_id: string | null; deleted_at: string | null }>(
    `select author_id, deleted_at from messages where id = $1 and channel_id = $2`,
    [messageId, channelId],
  );
  if (!row) throw new HttpError(404, "پیام پیدا نشد");
  if (row.deleted_at) throw new HttpError(410, "این پیام حذف شده است");
  return row;
}

/** ویرایش — فقط نویسنده‌ی خود پیام. */
export function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id, messageId } = await ctx.params;
    const user = await requireChannelPermission(id, "SEND_MESSAGE");

    const limited = rateLimit(`edit:${user.id}`, RATE.edit.limit, RATE.edit.windowMs);
    if (!limited.ok) throw new HttpError(429, "تعداد ویرایش زیاد شد");

    const row = await ownRow(messageId, id);
    if (row.author_id !== user.id) throw new HttpError(403, "فقط نویسنده می‌تواند ویرایش کند");

    const body = (await req.json().catch(() => ({}))) as { content?: string };
    const content = (body.content ?? "").trim();
    if (!content) throw new HttpError(400, "متن پیام خالی است");
    if (content.length > LIMITS.messageLength) {
      throw new HttpError(400, `حداکثر ${LIMITS.messageLength} نویسه`);
    }

    await q(`update messages set content = $1, edited_at = now() where id = $2`, [
      content,
      messageId,
    ]);
    const message = await loadMessage(user.id, messageId);
    await notify({ t: "message_update", messageId, channelId: id });
    return NextResponse.json({ message });
  });
}

/** حذف — نویسنده، یا هر کسی که MANAGE_MESSAGES دارد. */
export function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id, messageId } = await ctx.params;
    const user = await requireChannelPermission(id, "VIEW_CHANNEL");
    const row = await ownRow(messageId, id);

    const mask = await channelPermissions(user, id);
    const canModerate = user.isAdmin || has(mask, "MANAGE_MESSAGES");
    if (row.author_id !== user.id && !canModerate) {
      throw new HttpError(403, "اجازه‌ی حذف این پیام را نداری");
    }

    // soft delete: تاریخچه برای ممیزی می‌ماند ولی از UI می‌رود.
    await q(`update messages set deleted_at = now(), content = '' where id = $1`, [messageId]);
    if (row.author_id !== user.id) {
      await audit(user.id, "message.delete", messageId, { channelId: id });
    }
    await notify({ t: "message_delete", messageId, channelId: id });
    return NextResponse.json({ ok: true });
  });
}
