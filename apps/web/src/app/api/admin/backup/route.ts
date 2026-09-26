import { NextResponse } from "next/server";
import { one, q, tx } from "@/lib/db/pool";
import { handle, HttpError, requireUser } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** فقط ادمین: بکاپ کل ساختار سرور را می‌خواند و بازمی‌گرداند. */
async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) throw new HttpError(403, "فقط ادمین سرور می‌تواند بکاپ بگیرد");
  return user;
}

const MAX_BACKUPS = 10;

interface Snapshot {
  version: 1;
  takenAt: string;
  settings: { key: string; value: unknown }[];
  categories: { id: string; name: string; position: number }[];
  channels: {
    id: string;
    categoryId: string | null;
    name: string;
    type: string;
    topic: string | null;
    position: number;
    userLimit: number;
  }[];
  roles: {
    id: string;
    name: string;
    color: string;
    permissions: number;
    position: number;
    isDefault: boolean;
  }[];
  emojis: { name: string; kind: string; path: string; mime: string; size: number }[];
}

/**
 * عمداً پیام‌ها داخل بکاپ نیستند: هدف «بازسازی ساختار سرور» است، نه آرشیو محتوا.
 * این‌طور بکاپ کوچک می‌ماند و بازیابی هم پیام کسی را دوباره زنده نمی‌کند.
 */
async function snapshot(): Promise<Snapshot> {
  const [settings, categories, channels, roles, emojis] = await Promise.all([
    q<{ key: string; value: unknown }>(
      `select key, value from settings where key in ('server_profile', 'welcome_screen')`,
    ),
    q<{ id: string; name: string; position: number }>(
      `select id, name, position from categories order by position`,
    ),
    q<Snapshot["channels"][number]>(
      `select id, category_id as "categoryId", name, type, topic, position,
              user_limit as "userLimit"
         from channels order by position`,
    ),
    q<Snapshot["roles"][number]>(
      `select id, name, color, permissions, position, is_default as "isDefault"
         from roles order by position desc`,
    ),
    q<Snapshot["emojis"][number]>(
      `select name, kind, path, mime, size from server_emojis order by created_at`,
    ),
  ]);
  return {
    version: 1,
    takenAt: new Date().toISOString(),
    settings,
    categories,
    channels,
    roles,
    emojis,
  };
}

export function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const url = new URL(req.url);
    const download = url.searchParams.get("download");
    if (download) {
      const row = await one<{ payload: Snapshot; createdAt: string }>(
        `select payload, created_at as "createdAt" from server_backups where id = $1`,
        [download],
      );
      if (!row) throw new HttpError(404, "بکاپ پیدا نشد");
      return new NextResponse(JSON.stringify(row.payload, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="sr-backup-${download}.json"`,
        },
      });
    }
    const backups = await q(
      `select b.id, b.note, b.size, b.created_at as "createdAt",
              u.display_name as "createdBy"
         from server_backups b
         left join users u on u.id = b.created_by
        order by b.created_at desc`,
    );
    return NextResponse.json({ backups, max: MAX_BACKUPS });
  });
}

/** گرفتن بکاپ تازه. */
export function POST(req: Request) {
  return handle(async () => {
    const actor = await requireAdmin();
    const body = (await req.json().catch(() => ({}))) as { note?: string };
    const payload = await snapshot();
    const json = JSON.stringify(payload);
    const row = await one<{ id: string; createdAt: string }>(
      `insert into server_backups (note, payload, size, created_by)
       values ($1, $2::jsonb, $3, $4) returning id, created_at as "createdAt"`,
      [(body.note ?? "").trim().slice(0, 120), json, json.length, actor.id],
    );
    // سقف نگه‌داری تا جدول بی‌نهایت بزرگ نشود.
    await q(
      `delete from server_backups where id in (
         select id from server_backups order by created_at desc offset $1
       )`,
      [MAX_BACKUPS],
    );
    await audit(actor.id, "server.backup.create", row?.id ?? null, { size: json.length });
    return NextResponse.json({ backup: { ...row, size: json.length } }, { status: 201 });
  });
}

/**
 * بازیابی روی سرور فعلی. کانال و نقش موجود «به‌روز» می‌شود و نبودها ساخته؛
 * هیچ‌چیز حذف نمی‌شود تا یک بازیابی اشتباه، سرور زنده را خالی نکند.
 */
export function PATCH(req: Request) {
  return handle(async () => {
    const actor = await requireAdmin();
    const body = (await req.json().catch(() => ({}))) as { id?: string; payload?: Snapshot };
    let payload = body.payload;
    if (!payload && body.id) {
      const row = await one<{ payload: Snapshot }>(
        `select payload from server_backups where id = $1`,
        [body.id],
      );
      if (!row) throw new HttpError(404, "بکاپ پیدا نشد");
      payload = row.payload;
    }
    if (!payload || payload.version !== 1) throw new HttpError(400, "فایل بکاپ معتبر نیست");

    const applied = await tx(async (client) => {
      for (const item of payload.settings ?? []) {
        await client.query(
          `insert into settings (key, value) values ($1, $2::jsonb)
           on conflict (key) do update set value = excluded.value`,
          [item.key, JSON.stringify(item.value)],
        );
      }
      for (const category of payload.categories ?? []) {
        await client.query(
          `insert into categories (id, name, position) values ($1, $2, $3)
           on conflict (id) do update set name = excluded.name, position = excluded.position`,
          [category.id, category.name, category.position],
        );
      }
      for (const channel of payload.channels ?? []) {
        await client.query(
          `insert into channels (id, category_id, name, type, topic, position, user_limit)
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (id) do update set name = excluded.name, topic = excluded.topic,
             position = excluded.position, user_limit = excluded.user_limit,
             category_id = excluded.category_id`,
          [
            channel.id,
            channel.categoryId,
            channel.name,
            channel.type,
            channel.topic,
            channel.position,
            channel.userLimit,
          ],
        );
      }
      for (const role of payload.roles ?? []) {
        await client.query(
          `insert into roles (id, name, color, permissions, position, is_default)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (id) do update set name = excluded.name, color = excluded.color,
             permissions = excluded.permissions, position = excluded.position`,
          [role.id, role.name, role.color, role.permissions, role.position, role.isDefault],
        );
      }
      return {
        categories: payload.categories?.length ?? 0,
        channels: payload.channels?.length ?? 0,
        roles: payload.roles?.length ?? 0,
      };
    });

    await audit(actor.id, "server.backup.restore", body.id ?? "upload", applied);
    return NextResponse.json({ ok: true, applied });
  });
}

export function DELETE(req: Request) {
  return handle(async () => {
    const actor = await requireAdmin();
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const removed = await one(`delete from server_backups where id = $1 returning id`, [id]);
    if (!removed) throw new HttpError(404, "بکاپ پیدا نشد");
    await audit(actor.id, "server.backup.delete", id);
    return NextResponse.json({ ok: true });
  });
}
