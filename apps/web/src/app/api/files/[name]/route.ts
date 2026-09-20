import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { handle, HttpError, requireUser } from "@/lib/auth/guard";
import { one } from "@/lib/db/pool";
import { UPLOADS_DIR } from "@/lib/uploads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** سرو کردن فایل آپلودشده. نیازمند ورود است — فایل‌ها عمومی نیستند. */
export function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  return handle(async () => {
    await requireUser();
    const { name } = await ctx.params;

    // هر شکلی از traversal را قطع می‌کنیم.
    const safe = basename(name);
    if (safe !== name || safe.includes("..")) throw new HttpError(400, "نام فایل نامعتبر است");

    const row = await one<{ filename: string; mime: string }>(
      `select filename, mime from attachments where path = $1`,
      [safe],
    );
    if (!row) throw new HttpError(404, "فایل پیدا نشد");

    const full = join(UPLOADS_DIR, safe);
    const info = await stat(full).catch(() => null);
    if (!info?.isFile()) throw new HttpError(404, "فایل روی دیسک نیست");

    const stream = Readable.toWeb(createReadStream(full)) as ReadableStream;
    return new NextResponse(stream, {
      headers: {
        "content-type": row.mime || "application/octet-stream",
        "content-length": String(info.size),
        "cache-control": "private, max-age=31536000, immutable",
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
        "x-content-type-options": "nosniff",
      },
    });
  });
}
