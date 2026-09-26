import { NextResponse } from "next/server";
import { q } from "@/lib/db/pool";
import { handle, requireUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** ایموجی و استیکرهای سرور برای همه‌ی اعضا — پیکر پیام از همین می‌خواند. */
export function GET() {
  return handle(async () => {
    await requireUser();
    const rows = await q<{ id: string; name: string; kind: string; path: string }>(
      `select id, name, kind, path from server_emojis order by kind, created_at desc`,
    );
    return NextResponse.json({
      emojis: rows.map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        url: `/api/files/${row.path}`,
      })),
    });
  });
}
