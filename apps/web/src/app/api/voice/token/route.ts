import { NextResponse } from "next/server";
import { has } from "@sr/protocol";
import { one } from "@/lib/db/pool";
import { serverEnv } from "@/lib/env";
import { channelPermissions, handle, HttpError, requireUser } from "@/lib/auth/guard";
import { createVoiceToken } from "@/lib/livekit/token";

export const dynamic = "force-dynamic";

/**
 * توکن ورود به اتاق صوتی.
 * دسترسی در همین لحظه از نقش‌ها و override کانال محاسبه می‌شود، نه از کش کلاینت.
 */
export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();

    if (!serverEnv.livekit.apiKey || !serverEnv.livekit.publicUrl) {
      throw new HttpError(503, "سرویس صوت روی این سرور فعال نیست");
    }

    const body = (await req.json().catch(() => ({}))) as { channelId?: string };
    const channelId = body.channelId ?? "";

    const channel = await one<{ id: string; name: string; type: string; user_limit: number }>(
      `select id, name, type, user_limit from channels where id = $1`,
      [channelId],
    );
    if (!channel) throw new HttpError(404, "کانال پیدا نشد");
    if (channel.type === "text") throw new HttpError(400, "این کانال صوتی نیست");

    const mask = await channelPermissions(user, channel.id);
    if (!has(mask, "CONNECT_VOICE"))
      throw new HttpError(403, "اجازه‌ی اتصال به این کانال را نداری");

    // در استیج فقط کسی که اجازه‌ی مدیریت دارد می‌تواند صحبت کند.
    const canSpeak =
      channel.type === "stage"
        ? has(mask, "SPEAK") && has(mask, "MUTE_MEMBERS")
        : has(mask, "SPEAK");

    const canShare = canSpeak && has(mask, "SCREEN_SHARE");

    const token = createVoiceToken({
      identity: user.id,
      name: user.displayName,
      room: `channel:${channel.id}`,
      canPublish: canSpeak,
      metadata: { avatarColor: user.avatarColor, username: user.username },
    });

    return NextResponse.json({
      token,
      url: serverEnv.livekit.publicUrl,
      room: `channel:${channel.id}`,
      canSpeak,
      canShare,
      channel: { id: channel.id, name: channel.name, userLimit: channel.user_limit },
    });
  });
}
