import { NextResponse } from "next/server";
import { one, q, tx } from "@/lib/db/pool";
import { handle, HttpError, requireUser } from "@/lib/auth/guard";
import { verifyPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * حذف سرور = پاک کردن کل محتوای سرور (کانال، دسته، پیام، دعوت، ایموجی، نقش‌های غیرپیش‌فرض).
 * حساب‌ها و دوستی‌ها دست‌نخورده می‌مانند؛ این‌جا فقط «سرور» خالی می‌شود.
 * دو قفل دارد: رمز ادمین و تایپ دقیق نام سرور.
 */
export function POST(req: Request) {
  return handle(async () => {
    const actor = await requireUser();
    if (!actor.isAdmin) throw new HttpError(403, "فقط ادمین سرور می‌تواند سرور را حذف کند");

    const body = (await req.json().catch(() => ({}))) as { password?: string; confirm?: string };
    if (!body.password) throw new HttpError(400, "رمز عبور لازم است");

    const row = await one<{ passwordHash: string }>(
      `select password_hash as "passwordHash" from users where id = $1`,
      [actor.id],
    );
    if (!row || !(await verifyPassword(body.password, row.passwordHash))) {
      throw new HttpError(403, "رمز عبور درست نیست");
    }

    const profile = await one<{ value: { name?: string } }>(
      `select value from settings where key = 'server_profile'`,
    );
    const name = profile?.value?.name ?? "SR-Connect";
    if ((body.confirm ?? "").trim() !== name) {
      throw new HttpError(400, `برای تأیید، دقیقاً «${name}» را تایپ کن`);
    }

    // آخرین بکاپ خودکار پیش از حذف؛ اگر پشیمان شد، ساختار برمی‌گردد.
    const snapshotRows = await Promise.all([
      q(`select key, value from settings where key in ('server_profile', 'welcome_screen')`),
      q(`select id, name, position from categories order by position`),
      q(`select id, category_id as "categoryId", name, type, topic, position,
                user_limit as "userLimit" from channels order by position`),
      q(`select id, name, color, permissions, position, is_default as "isDefault" from roles`),
      q(`select name, kind, path, mime, size from server_emojis`),
    ]);
    const payload = {
      version: 1 as const,
      takenAt: new Date().toISOString(),
      settings: snapshotRows[0],
      categories: snapshotRows[1],
      channels: snapshotRows[2],
      roles: snapshotRows[3],
      emojis: snapshotRows[4],
    };
    const json = JSON.stringify(payload);
    await q(
      `insert into server_backups (note, payload, size, created_by)
       values ('بکاپ خودکار پیش از حذف سرور', $1::jsonb, $2, $3)`,
      [json, json.length, actor.id],
    );

    await tx(async (client) => {
      await client.query(`delete from channels`);
      await client.query(`delete from categories`);
      await client.query(`delete from invites`);
      await client.query(`delete from server_emojis`);
      await client.query(`delete from roles where is_default = false`);
    });

    await audit(actor.id, "server.delete", "server", { name });
    return NextResponse.json({ ok: true });
  });
}
