import { NextResponse } from "next/server";
import { q } from "@/lib/db/pool";
import { handle, HttpError, requireUser } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * ترک سرور: نقش‌ها برداشته و همه‌ی نشست‌ها بسته می‌شود.
 * حساب پاک نمی‌شود تا پیام‌های قبلی «کاربر حذف‌شده» نشوند.
 */
export function POST() {
  return handle(async () => {
    const user = await requireUser();
    if (user.isAdmin) {
      throw new HttpError(403, "ادمین نمی‌تواند سرور را ترک کند؛ اول مالکیت را واگذار کن");
    }
    await q(`delete from user_roles where user_id = $1`, [user.id]);
    await q(`delete from sessions where user_id = $1`, [user.id]);
    await audit(user.id, "server.leave", user.id);
    return NextResponse.json({ ok: true });
  });
}
