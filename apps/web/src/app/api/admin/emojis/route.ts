import { NextResponse } from "next/server";
import { one, q } from "@/lib/db/pool";
import { handle, HttpError, requirePermission } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { isImage, storeFile } from "@/lib/uploads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** سقف‌ها عمداً کوچک‌اند: ایموجی باید سریع لود شود، نه اینکه گالری عکس باشد. */
const MAX_EMOJI_BYTES = 512 * 1024;
const MAX_STICKER_BYTES = 1024 * 1024;
const MAX_PER_KIND = { emoji: 100, sticker: 50 } as const;
const NAME_RE = /^[a-z0-9_]{2,32}$/;

export function GET() {
  return handle(async () => {
    await requirePermission("MANAGE_CHANNELS");
    const rows = await q(
      `select e.id, e.name, e.kind, e.path, e.size, e.created_at as "createdAt",
              u.display_name as "createdBy"
         from server_emojis e
         left join users u on u.id = e.created_by
        order by e.kind, e.created_at desc`,
    );
    return NextResponse.json({
      emojis: rows.map((row) => ({ ...row, url: `/api/files/${row.path as string}` })),
      limits: { emoji: MAX_PER_KIND.emoji, sticker: MAX_PER_KIND.sticker },
    });
  });
}

/** آپلود ایموجی یا استیکر اختصاصی سرور. */
export function POST(req: Request) {
  return handle(async () => {
    const actor = await requirePermission("MANAGE_CHANNELS");
    const form = await req.formData().catch(() => null);
    if (!form) throw new HttpError(400, "فرم نامعتبر است");

    const kind = form.get("kind") === "sticker" ? "sticker" : "emoji";
    const name = String(form.get("name") ?? "")
      .trim()
      .toLowerCase();
    if (!NAME_RE.test(name)) {
      throw new HttpError(400, "نام باید ۲ تا ۳۲ نویسه‌ی انگلیسی، عدد یا زیرخط باشد");
    }

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "فایلی فرستاده نشد");
    if (!isImage(file.type)) throw new HttpError(415, "فقط تصویر پذیرفته می‌شود");
    const max = kind === "sticker" ? MAX_STICKER_BYTES : MAX_EMOJI_BYTES;
    if (file.size > max) {
      throw new HttpError(413, `حداکثر حجم ${Math.round(max / 1024)} کیلوبایت است`);
    }

    const count = await one<{ total: string }>(
      `select count(*)::text as total from server_emojis where kind = $1`,
      [kind],
    );
    if (Number(count?.total ?? 0) >= MAX_PER_KIND[kind]) {
      throw new HttpError(409, `سقف ${MAX_PER_KIND[kind]} مورد برای این نوع پر شده است`);
    }

    const duplicate = await one(`select id from server_emojis where kind = $1 and name = $2`, [
      kind,
      name,
    ]);
    if (duplicate) throw new HttpError(409, "این نام قبلاً استفاده شده است");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { stored, size } = await storeFile(bytes, file.name);
    const row = await one<{ id: string }>(
      `insert into server_emojis (name, kind, path, mime, size, created_by)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [name, kind, stored, file.type, size, actor.id],
    );
    await audit(actor.id, "server.emoji.create", row?.id ?? null, { name, kind });

    return NextResponse.json(
      { emoji: { id: row!.id, name, kind, size, url: `/api/files/${stored}` } },
      { status: 201 },
    );
  });
}

export function DELETE(req: Request) {
  return handle(async () => {
    const actor = await requirePermission("MANAGE_CHANNELS");
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const removed = await one<{ name: string; kind: string }>(
      `delete from server_emojis where id = $1 returning name, kind`,
      [id],
    );
    if (!removed) throw new HttpError(404, "پیدا نشد");
    await audit(actor.id, "server.emoji.delete", id, removed);
    return NextResponse.json({ ok: true });
  });
}
