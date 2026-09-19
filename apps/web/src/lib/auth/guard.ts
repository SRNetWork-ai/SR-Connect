import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { effectivePermissions, has, type PermissionName } from "@sr/protocol";
import { q } from "@/lib/db/pool";
import { currentUser, SESSION_COOKIE, userFromToken, type SessionUser } from "@/lib/auth/session";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "برای این کار باید وارد شوی");
  return user;
}

export async function requirePermission(permission: PermissionName): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin && !has(user.permissions, permission)) {
    throw new HttpError(403, "دسترسی لازم را نداری");
  }
  return user;
}

/** ماسک نهایی کاربر در یک کانال = نقش‌ها، سپس override همان کانال. */
export async function channelPermissions(user: SessionUser, channelId: string): Promise<number> {
  if (user.isAdmin) return effectivePermissions([user.permissions | 0], []);
  const overrides = await q<{ allow: number; deny: number }>(
    `select co.allow, co.deny
       from channel_overrides co
       join user_roles ur on ur.role_id = co.role_id
      where co.channel_id = $1 and ur.user_id = $2`,
    [channelId, user.id],
  );
  return effectivePermissions([user.permissions], overrides);
}

export async function requireChannelPermission(
  channelId: string,
  permission: PermissionName,
): Promise<SessionUser> {
  const user = await requireUser();
  if (user.isAdmin) return user;
  const mask = await channelPermissions(user, channelId);
  if (!has(mask, permission)) throw new HttpError(403, "دسترسی لازم در این کانال را نداری");
  return user;
}

/** توکن خام از هدر Authorization — برای کلاینت نیتیو که کوکی ندارد. */
export async function userFromRequest(req: Request): Promise<SessionUser | null> {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return userFromToken(header.slice(7));
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
}

/** پوشش یکسان خطاها: هیچ استک‌تریسی به کلاینت نمی‌رود. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api]", err);
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
