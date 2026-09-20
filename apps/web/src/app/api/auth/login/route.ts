import { NextResponse } from "next/server";
import { one } from "@/lib/db/pool";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, loadUser, sessionCookie } from "@/lib/auth/session";
import { handle, HttpError } from "@/lib/auth/guard";
import { clientIp, rateLimit, RATE } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json().catch(() => ({}))) as {
      identity?: string;
      password?: string;
    };
    const identity = (body.identity ?? "").trim();
    const password = body.password ?? "";
    if (!identity || !password) throw new HttpError(400, "نام کاربری و گذرواژه لازم است");

    // brute-force را هم روی IP و هم روی نام کاربری می‌بندیم.
    const ip = clientIp(req);
    for (const key of [`login:ip:${ip}`, `login:id:${identity.toLowerCase()}`]) {
      const limited = rateLimit(key, RATE.login.limit, RATE.login.windowMs);
      if (!limited.ok) {
        throw new HttpError(429, "تلاش‌های ناموفق زیاد شد؛ یک دقیقه بعد دوباره امتحان کن");
      }
    }

    const row = await one<{ id: string; password_hash: string }>(
      `select id, password_hash from users where username = $1 or email = $1 limit 1`,
      [identity],
    );

    // پاسخ یکسان برای «کاربر نیست» و «گذرواژه غلط» تا نام کاربری لو نرود.
    const ok = row ? await verifyPassword(password, row.password_hash) : false;
    if (!row || !ok) throw new HttpError(401, "نام کاربری یا گذرواژه درست نیست");

    const { token, expiresAt } = await createSession(row.id, {
      userAgent: req.headers.get("user-agent"),
    });
    const user = await loadUser(row.id);

    await audit(row.id, "user.login", row.id, { ip });

    const res = NextResponse.json({ user });
    res.cookies.set(sessionCookie(token, expiresAt));
    return res;
  });
}
