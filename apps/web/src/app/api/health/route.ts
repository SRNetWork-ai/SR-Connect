import { NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/** پینگ سبک. اسپلش و صفحه‌ی ثبت‌نام با این تصمیم می‌گیرند. */
export async function GET() {
  let db = "ok";
  try {
    await pool.query("select 1");
  } catch {
    db = "down";
  }

  return NextResponse.json(
    {
      ok: db === "ok",
      service: "sr-connect-web",
      db,
      time: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      registration: serverEnv.allowRegistration,
      requireInvite: serverEnv.requireInvite,
      voice: Boolean(serverEnv.livekit.publicUrl),
    },
    { status: db === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
