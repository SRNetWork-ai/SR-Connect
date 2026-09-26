import { NextResponse } from "next/server";
import { q } from "@/lib/db/pool";
import { handle, requireUser } from "@/lib/auth/guard";
import { loadWelcome } from "@/lib/welcome";

export const dynamic = "force-dynamic";

/** نسخه‌ی عضو: فقط وقتی فعال است و کانال‌های حذف‌شده کنار گذاشته می‌شوند. */
export function GET() {
  return handle(async () => {
    await requireUser();
    const welcome = await loadWelcome();
    if (!welcome.enabled) return NextResponse.json({ welcome: null });
    const ids = welcome.channels.map((item) => item.channelId);
    const known = ids.length
      ? await q<{ id: string; name: string }>(
          `select id, name from channels where id = any($1::uuid[])`,
          [ids],
        )
      : [];
    const byId = new Map(known.map((row) => [row.id, row.name]));
    return NextResponse.json({
      welcome: {
        ...welcome,
        channels: welcome.channels
          .filter((item) => byId.has(item.channelId))
          .map((item) => ({ ...item, name: byId.get(item.channelId)! })),
      },
    });
  });
}
