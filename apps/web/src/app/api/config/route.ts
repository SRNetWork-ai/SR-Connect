import { NextResponse } from "next/server";
import { API_VERSION } from "@sr/protocol";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * پیکربندی عمومی در زمان اجرا.
 *
 * چرا لازم است: مقادیر NEXT_PUBLIC_* هنگام بیلد داخل باندل می‌روند. اگر بخواهیم
 * یک ایمیج آماده روی هر سروری بالا بیاید (تا سرورهای ۱ هسته/۲ گیگ مجبور به بیلد
 * نباشند)، این مقادیر باید در زمان اجرا خوانده شوند، نه بیلد.
 * هیچ راز و اطلاعات خصوصی اینجا برنمی‌گردد.
 */
export function GET() {
  return NextResponse.json(
    {
      apiVersion: API_VERSION,
      appVersion: process.env.APP_VERSION ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0",
      updateChannel: serverEnv.updates.channel,
      updatePubkey: serverEnv.updates.publicKey,
      allowRegistration: serverEnv.allowRegistration,
      requireInvite: serverEnv.requireInvite,
      voiceEnabled: Boolean(serverEnv.livekit.apiKey && serverEnv.livekit.publicUrl),
      voiceCapacity: serverEnv.voiceCapacity,
    },
    { headers: { "cache-control": "public, max-age=30" } },
  );
}
