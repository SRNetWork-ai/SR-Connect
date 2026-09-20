import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { PublicUser } from "@sr/protocol";
import { one, q } from "@/lib/db/pool";
import { serverEnv } from "@/lib/env";

export const SESSION_COOKIE = "sr_session";

function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  avatar_url: string | null;
  bio: string | null;
  status: PublicUser["status"];
  is_admin: boolean;
  roles: { id: string; name: string; color: string }[] | null;
  permissions: number | null;
}

const USER_SELECT = `
  select u.id, u.username, u.display_name, u.avatar_color, u.avatar_url, u.bio, u.status, u.is_admin,
         coalesce(
           json_agg(json_build_object('id', r.id, 'name', r.name, 'color', r.color))
             filter (where r.id is not null),
           '[]'
         ) as roles,
         coalesce(bit_or(r.permissions), 0) as permissions
    from users u
    left join user_roles ur on ur.user_id = u.id
    left join roles r on r.id = ur.role_id`;

export interface SessionUser extends PublicUser {
  permissions: number;
}

function toUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    status: row.status,
    isAdmin: row.is_admin,
    roles: row.roles ?? [],
    permissions: row.permissions ?? 0,
  };
}

/** توکن تصادفی به کاربر می‌رود؛ فقط هشِ آن در دیتابیس می‌ماند. */
export async function createSession(
  userId: string,
  meta: { userAgent?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + serverEnv.sessionTtlDays * 86_400_000);
  await q(
    `insert into sessions (user_id, token_hash, user_agent, expires_at)
     values ($1, $2, $3, $4)`,
    [userId, sha256(token), meta.userAgent ?? null, expiresAt],
  );
  return { token, expiresAt };
}

/** اعتبارسنجی توکن + تمدید نرم last_used_at. */
export async function userFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;

  const row = await one<UserRow>(
    `${USER_SELECT}
      join sessions s on s.user_id = u.id
     where s.token_hash = $1 and s.expires_at > now()
     group by u.id`,
    [sha256(token)],
  );
  if (!row) return null;

  void q(`update sessions set last_used_at = now() where token_hash = $1`, [sha256(token)]);
  return toUser(row);
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
}

export async function loadUser(userId: string): Promise<SessionUser | null> {
  const row = await one<UserRow>(`${USER_SELECT} where u.id = $1 group by u.id`, [userId]);
  return row ? toUser(row) : null;
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await q(`delete from sessions where token_hash = $1`, [sha256(token)]);
}

export async function pruneSessions(): Promise<void> {
  await q(`delete from sessions where expires_at < now()`);
}

export function sessionCookie(token: string, expiresAt: Date) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}
