import { NextResponse } from "next/server";
import { one, q } from "@/lib/db/pool";
import { handle, HttpError, requireUser } from "@/lib/auth/guard";
import { conversation, requireDirectAccess } from "@/lib/dm";
import { createVoiceToken } from "@/lib/livekit/token";
import { serverEnv } from "@/lib/env";
import { rateLimit, RATE } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** تماس زنگ‌خورده بعد از این مدت «بی‌پاسخ» حساب می‌شود. */
const RING_TIMEOUT_MS = 45_000;

interface CallRow {
  id: string;
  conversationId: string;
  status: string;
  video: boolean;
  callerId: string;
  calleeId: string;
}

function requireVoiceService() {
  if (!serverEnv.livekit.apiKey || !serverEnv.livekit.publicUrl) {
    throw new HttpError(503, "سرویس صوت روی این سرور فعال نیست");
  }
}

/** زنگ‌های قدیمی را پیش از هر تصمیمی می‌بندیم تا کسی پشت خط نماند. */
async function expireStaleCalls() {
  await q(
    `update direct_calls
        set status = 'missed', ended_at = now()
      where status = 'ringing' and created_at < now() - ($1::int * interval '1 millisecond')`,
    [RING_TIMEOUT_MS],
  );
}

/** شروع تماس خصوصی: یک اتاق اختصاصی برای همان گفت‌وگو. */
export function POST(req: Request, ctx: { params: Promise<{ userId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { userId: peerId } = await ctx.params;
    requireVoiceService();
    await requireDirectAccess(user.id, peerId);
    await expireStaleCalls();

    const limited = rateLimit(`call:${user.id}`, RATE.message.limit, RATE.message.windowMs);
    if (!limited.ok) throw new HttpError(429, "تعداد تماس زیاد شد، کمی صبر کن");

    const body = (await req.json().catch(() => ({}))) as { video?: boolean };
    const video = body.video === true;
    const conv = await conversation(user.id, peerId, true);
    if (!conv) throw new HttpError(404, "گفت‌وگو ساخته نشد");

    // اگر طرف مقابل همین حالا زنگ زده، به‌جای زنگ دوم همان تماس را برمی‌داریم.
    const existing = await one<CallRow>(
      `select id, conversation_id as "conversationId", status, video,
              caller_id as "callerId", callee_id as "calleeId"
         from direct_calls
        where conversation_id = $1 and status in ('ringing', 'active')
        order by created_at desc limit 1`,
      [conv.id],
    );

    let call = existing;
    if (existing && existing.calleeId === user.id) {
      call = await one<CallRow>(
        `update direct_calls set status = 'active', answered_at = now()
          where id = $1
        returning id, conversation_id as "conversationId", status, video,
                  caller_id as "callerId", callee_id as "calleeId"`,
        [existing.id],
      );
    } else if (!existing) {
      call = await one<CallRow>(
        `insert into direct_calls (conversation_id, caller_id, callee_id, video)
         values ($1, $2, $3, $4)
         returning id, conversation_id as "conversationId", status, video,
                   caller_id as "callerId", callee_id as "calleeId"`,
        [conv.id, user.id, peerId, video],
      );
    }

    const token = createVoiceToken({
      identity: user.id,
      name: user.displayName,
      room: `dm:${conv.id}`,
      canPublish: true,
      metadata: { avatarColor: user.avatarColor, username: user.username },
    });

    const peer = await one<{ displayName: string }>(
      `select display_name as "displayName" from users where id = $1`,
      [peerId],
    );

    return NextResponse.json({
      token,
      url: serverEnv.livekit.publicUrl,
      room: `dm:${conv.id}`,
      canSpeak: true,
      canShare: true,
      call,
      channel: { id: conv.id, name: peer?.displayName ?? "تماس خصوصی", userLimit: 2 },
    });
  });
}

/** وضعیت تماس جاری این گفت‌وگو — برای نمایش «در حال زنگ خوردن». */
export function GET(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { userId: peerId } = await ctx.params;
    await expireStaleCalls();
    const conv = await conversation(user.id, peerId, false);
    if (!conv) return NextResponse.json({ call: null });
    const call = await one<CallRow>(
      `select id, conversation_id as "conversationId", status, video,
              caller_id as "callerId", callee_id as "calleeId"
         from direct_calls
        where conversation_id = $1 and status in ('ringing', 'active')
        order by created_at desc limit 1`,
      [conv.id],
    );
    return NextResponse.json({ call });
  });
}

/** پایان یا رد تماس. هر دو طرف اجازه دارند قطع کنند. */
export function DELETE(req: Request, ctx: { params: Promise<{ userId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { userId: peerId } = await ctx.params;
    const conv = await conversation(user.id, peerId, false);
    if (!conv) return NextResponse.json({ ok: true });
    const declined = new URL(req.url).searchParams.get("declined") === "1";
    await q(
      `update direct_calls
          set status = $2, ended_at = now()
        where conversation_id = $1 and status in ('ringing', 'active')
          and (caller_id = $3 or callee_id = $3)`,
      [conv.id, declined ? "declined" : "ended", user.id],
    );
    return NextResponse.json({ ok: true });
  });
}
