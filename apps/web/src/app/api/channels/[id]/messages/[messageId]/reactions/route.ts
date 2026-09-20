import { NextResponse } from "next/server";
import { LIMITS } from "@sr/protocol";
import { one, q } from "@/lib/db/pool";
import { handle, HttpError, requireChannelPermission } from "@/lib/auth/guard";
import { notify } from "@/lib/db/events";
import { loadReactions } from "@/lib/db/messages";
import { rateLimit, RATE } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; messageId: string }> };

/** ایموجی را نرمال می‌کنیم تا یک نفر با نویسه‌های نامرئی چند ردیف نسازد. */
function normalizeEmoji(raw: unknown): string {
  const e = String(raw ?? "")
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
  if (!e || e.length > LIMITS.emojiLength) throw new HttpError(400, "ایموجی نامعتبر است");
  return e;
}

async function assertMessage(messageId: string, channelId: string) {
  const row = await one<{ id: string }>(
    `select id from messages where id = $1 and channel_id = $2 and deleted_at is null`,
    [messageId, channelId],
  );
  if (!row) throw new HttpError(404, "پیام پیدا نشد");
}

export function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id, messageId } = await ctx.params;
    const user = await requireChannelPermission(id, "ADD_REACTION");

    const limited = rateLimit(`rx:${user.id}`, RATE.reaction.limit, RATE.reaction.windowMs);
    if (!limited.ok) throw new HttpError(429, "تعداد ری‌اکشن زیاد شد");

    const body = (await req.json().catch(() => ({}))) as { emoji?: string };
    const emoji = normalizeEmoji(body.emoji);
    await assertMessage(messageId, id);

    const distinct = await one<{ n: number }>(
      `select count(distinct emoji)::int as n from message_reactions where message_id = $1`,
      [messageId],
    );
    if ((distinct?.n ?? 0) >= LIMITS.reactionsPerMessage) {
      throw new HttpError(400, "تعداد ری‌اکشن‌های این پیام پر است");
    }

    await q(
      `insert into message_reactions (message_id, user_id, emoji)
       values ($1, $2, $3) on conflict do nothing`,
      [messageId, user.id, emoji],
    );

    const reactions = await loadReactions(user.id, messageId);
    await notify({ t: "reaction_update", messageId, channelId: id });
    return NextResponse.json({ reactions });
  });
}

export function DELETE(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id, messageId } = await ctx.params;
    const user = await requireChannelPermission(id, "VIEW_CHANNEL");
    const emoji = normalizeEmoji(new URL(req.url).searchParams.get("emoji"));

    await q(`delete from message_reactions where message_id = $1 and user_id = $2 and emoji = $3`, [
      messageId,
      user.id,
      emoji,
    ]);

    const reactions = await loadReactions(user.id, messageId);
    await notify({ t: "reaction_update", messageId, channelId: id });
    return NextResponse.json({ reactions });
  });
}
