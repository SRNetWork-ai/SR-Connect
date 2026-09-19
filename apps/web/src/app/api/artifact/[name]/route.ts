import { createHash } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { devBytes, resolveDevArtifact } from "@/server/dev-artifacts";

export const dynamic = "force-dynamic";

/**
 * سرو کردن بسته‌ی آپدیت.
 * ۱) اگر فایل واقعی در RELEASES_DIR باشد، استریم می‌شود.
 * ۲) وگرنه آرتیفکت قطعیِ توسعه ساخته می‌شود تا مسیر آپدیت همیشه تست‌پذیر بماند.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name: raw } = await ctx.params;
  // فقط نام فایل؛ هیچ «..» یا مسیری پذیرفته نمی‌شود.
  const name = basename(raw);
  if (!/^[A-Za-z0-9._-]{3,120}$/.test(name)) {
    return NextResponse.json({ error: "نام فایل نامعتبر است" }, { status: 400 });
  }

  const dir = serverEnv.updates.releasesDir;
  if (dir) {
    const root = resolve(dir);
    const full = resolve(join(root, name));
    if (full.startsWith(root + "/") && existsSync(full) && statSync(full).isFile()) {
      const size = statSync(full).size;
      const stream = Readable.toWeb(createReadStream(full)) as ReadableStream;
      return new NextResponse(stream, {
        headers: {
          "content-type": "application/octet-stream",
          "content-length": String(size),
          "content-disposition": `attachment; filename="${name}"`,
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }
  }

  const dev = resolveDevArtifact(name);
  if (!dev) return NextResponse.json({ error: "بسته پیدا نشد" }, { status: 404 });

  const buf = devBytes(dev.seed, dev.size);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/octet-stream",
      "content-length": String(buf.length),
      etag: `"${createHash("sha256").update(buf).digest("hex").slice(0, 16)}"`,
      "cache-control": "public, max-age=31536000, immutable",
      "x-sr-artifact": "dev",
    },
  });
}
