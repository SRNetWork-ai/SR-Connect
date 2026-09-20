import { NextResponse } from "next/server";
import { one, q, tx } from "@/lib/db/pool";
import { serverEnv } from "@/lib/env";
import { hashPassword, passwordProblems } from "@/lib/auth/password";
import { createSession, sessionCookie } from "@/lib/auth/session";
import { handle, HttpError } from "@/lib/auth/guard";
import { clientIp, rateLimit, RATE } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const COLORS = ["#5865F2", "#23A55A", "#F0B232", "#EB459E", "#00A8FC", "#9B59B6"];

export function POST(req: Request) {
  return handle(async () => {
    if (!serverEnv.allowRegistration) throw new HttpError(403, "ثبت‌نام روی این سرور بسته است");

    const limited = rateLimit(`reg:${clientIp(req)}`, RATE.register.limit, RATE.register.windowMs);
    if (!limited.ok) throw new HttpError(429, "تعداد ثبت‌نام از این آی‌پی زیاد شد");

    const body = (await req.json().catch(() => ({}))) as {
      username?: string;
      displayName?: string;
      email?: string;
      password?: string;
      invite?: string;
    };

    const username = (body.username ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!/^[a-z0-9._-]{3,24}$/.test(username)) {
      throw new HttpError(400, "نام کاربری باید ۳ تا ۲۴ نویسه از a-z، رقم، نقطه، خط تیره باشد");
    }
    const problems = passwordProblems(password);
    if (problems.length) throw new HttpError(400, `گذرواژه ضعیف است: ${problems.join(" · ")}`);

    let inviteRoleId: string | null = null;
    if (serverEnv.requireInvite) {
      const code = (body.invite ?? "").trim();
      const invite = await one<{
        code: string;
        role_id: string | null;
        max_uses: number;
        uses: number;
      }>(
        `select code, role_id, max_uses, uses from invites
          where code = $1 and (expires_at is null or expires_at > now())`,
        [code],
      );
      if (!invite) throw new HttpError(400, "کد دعوت معتبر نیست");
      if (invite.max_uses > 0 && invite.uses >= invite.max_uses) {
        throw new HttpError(400, "ظرفیت این دعوت‌نامه تمام شده است");
      }
      inviteRoleId = invite.role_id;
      await q(`update invites set uses = uses + 1 where code = $1`, [code]);
    }

    const taken = await one(`select 1 from users where username = $1`, [username]);
    if (taken) throw new HttpError(409, "این نام کاربری گرفته شده است");

    const passwordHash = await hashPassword(password);

    const userId = await tx(async (c) => {
      // اولین کاربر سرور خودکار ادمین می‌شود.
      const { rows: countRows } = await c.query<{ n: string }>(
        `select count(*)::text as n from users`,
      );
      const isFirst = countRows[0]?.n === "0";

      const { rows } = await c.query<{ id: string }>(
        `insert into users (username, email, display_name, password_hash, avatar_color, is_admin)
         values ($1, $2, $3, $4, $5, $6) returning id`,
        [
          username,
          body.email?.trim() || null,
          (body.displayName ?? username).trim().slice(0, 40) || username,
          passwordHash,
          COLORS[username.length % COLORS.length],
          isFirst,
        ],
      );
      const id = rows[0]!.id;

      const roleId =
        inviteRoleId ??
        (await c.query<{ id: string }>(`select id from roles where is_default limit 1`)).rows[0]
          ?.id;
      if (roleId) {
        await c.query(`insert into user_roles (user_id, role_id) values ($1, $2)`, [id, roleId]);
      }
      if (isFirst) {
        const admin = (
          await c.query<{ id: string }>(`select id from roles where name = 'ادمین' limit 1`)
        ).rows[0];
        if (admin) {
          await c.query(
            `insert into user_roles (user_id, role_id) values ($1, $2) on conflict do nothing`,
            [id, admin.id],
          );
        }
      }
      return id;
    });

    const { token, expiresAt } = await createSession(userId, {
      userAgent: req.headers.get("user-agent"),
    });
    const res = NextResponse.json({ ok: true }, { status: 201 });
    res.cookies.set(sessionCookie(token, expiresAt));
    return res;
  });
}
