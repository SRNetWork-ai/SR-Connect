import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { one, q } from "@/lib/db/pool";
import { handle, HttpError, requireUser } from "@/lib/auth/guard";
import { loadUser } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";

export const dynamic = "force-dynamic";

const COLOR = /^#[0-9a-f]{6}$/i;

/** ویرایش پروفایل خود کاربر: نام نمایشی، رنگ، بیو و آواتار. */
export function PATCH(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as {
      displayName?: string;
      avatarColor?: string;
      bio?: string | null;
      avatarAttachmentId?: string | null;
    };

    const sets: string[] = [];
    const vals: unknown[] = [];
    const push = (frag: string, v: unknown) => {
      vals.push(v);
      sets.push(`${frag} = $${vals.length}`);
    };

    if (body.displayName !== undefined) {
      const name = body.displayName.trim();
      if (name.length < 2 || name.length > 32) throw new HttpError(400, "نام بین ۲ تا ۳۲ نویسه");
      push("display_name", name);
    }
    if (body.avatarColor !== undefined) {
      if (!COLOR.test(body.avatarColor)) throw new HttpError(400, "کد رنگ نامعتبر است");
      push("avatar_color", body.avatarColor);
    }
    if (body.bio !== undefined) {
      push("bio", body.bio ? body.bio.slice(0, 280) : null);
    }
    if (body.avatarAttachmentId !== undefined) {
      if (body.avatarAttachmentId === null) {
        push("avatar_url", null);
      } else {
        const att = await one<{ path: string; mime: string }>(
          `select path, mime from attachments where id = $1`,
          [body.avatarAttachmentId],
        );
        if (!att) throw new HttpError(404, "فایل آواتار پیدا نشد");
        if (!att.mime.startsWith("image/")) throw new HttpError(415, "آواتار باید تصویر باشد");
        push("avatar_url", `/api/files/${att.path}`);
      }
    }

    if (sets.length === 0) throw new HttpError(400, "چیزی برای تغییر نفرستادی");
    vals.push(user.id);
    await q(`update users set ${sets.join(", ")} where id = $${vals.length}`, vals);

    return NextResponse.json({ user: await loadUser(user.id) });
  });
}

/** حذف حساب فقط بعد از تأیید رمز؛ حذف آخرین مدیر مجاز نیست. */
export function DELETE(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { password?: string };
    const row = await one<{ passwordHash: string }>(
      `select password_hash as "passwordHash" from users where id = $1`,
      [user.id],
    );
    if (!row || !(await verifyPassword(body.password ?? "", row.passwordHash))) {
      throw new HttpError(403, "رمز حساب درست نیست");
    }
    if (user.isAdmin) {
      const admins = await one<{ total: number }>(
        `select count(*)::int as total from users where is_admin = true`,
      );
      if ((admins?.total ?? 0) <= 1) {
        throw new HttpError(409, "آخرین مدیر سرور را نمی‌توان حذف کرد");
      }
    }
    await q(`delete from users where id = $1`, [user.id]);
    const res = NextResponse.json({ ok: true });
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
    res.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
    return res;
  });
}
