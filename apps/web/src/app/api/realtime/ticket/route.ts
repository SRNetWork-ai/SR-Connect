import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { q } from "@/lib/db/pool";
import { handle, requireUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** بلیت ۶۰ ثانیه‌ای و یک‌بارمصرف برای دست‌دادن با گیت‌وی realtime. */
export function POST() {
  return handle(async () => {
    const user = await requireUser();
    const token = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(token).digest("hex");

    await q(
      `insert into realtime_tickets (token_hash, user_id, expires_at)
       values ($1, $2, now() + interval '60 seconds')`,
      [hash, user.id],
    );
    // پاکسازی تنبل تا جدول ورم نکند.
    void q(`delete from realtime_tickets where expires_at < now() - interval '1 hour'`).catch(
      () => {},
    );

    return NextResponse.json({ ticket: token, expiresIn: 60 });
  });
}
