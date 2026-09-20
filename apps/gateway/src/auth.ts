import { createHash } from "node:crypto";
import type { PublicUser } from "@sr/protocol";
import { ALL_PERMISSIONS, effectivePermissions } from "@sr/protocol";
import { q } from "./db.js";

export interface GatewayUser extends PublicUser {
  permissions: number;
}

interface Row {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  avatar_url: string | null;
  status: string;
  is_admin: boolean;
  roles: { id: string; name: string; color: string; permissions: number }[] | null;
}

/**
 * دو راه پذیرفته می‌شود:
 *  ۱) بلیت یک‌بارمصرف که اپ وب از /api/realtime/ticket گرفته (مسیر مرورگر).
 *  ۲) توکن نشست خام که کلاینت نیتیو خودش نگه داشته است.
 * در هر دو حالت فقط هشِ توکن در دیتابیس است، پس گیت‌وی بدون تماس HTTP با اپ
 * هویت را تأیید می‌کند.
 */
export async function authenticate(token: string): Promise<GatewayUser | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const hash = createHash("sha256").update(token).digest("hex");

  // مصرف اتمیک بلیت: اگر قبلاً استفاده شده یا منقضی است، چیزی برنمی‌گردد.
  const ticket = await q<{ user_id: string }>(
    `update realtime_tickets set used_at = now()
      where token_hash = $1 and used_at is null and expires_at > now()
      returning user_id`,
    [hash],
  ).catch(() => [] as { user_id: string }[]);

  return ticket[0] ? loadUser(ticket[0].user_id, "ticket") : loadUser(hash, "session");
}

async function loadUser(key: string, mode: "ticket" | "session"): Promise<GatewayUser | null> {
  const where =
    mode === "ticket"
      ? `u.id = $1`
      : `exists (select 1 from sessions s
                  where s.user_id = u.id and s.token_hash = $1 and s.expires_at > now())`;

  const rows = await q<Row>(
    `select u.id, u.username, u.display_name, u.avatar_color, u.avatar_url, u.status, u.is_admin,
            coalesce(
              (select json_agg(json_build_object(
                  'id', r.id, 'name', r.name, 'color', r.color, 'permissions', r.permissions)
                  order by r.position desc)
                 from user_roles ur join roles r on r.id = ur.role_id
                where ur.user_id = u.id),
              '[]'::json
            ) as roles
       from users u
      where ${where}
      limit 1`,
    [key],
  );

  const row = rows[0];
  if (!row) return null;
  const roles = row.roles ?? [];

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    avatarUrl: row.avatar_url,
    status: (row.status as PublicUser["status"]) ?? "offline",
    isAdmin: row.is_admin,
    roles: roles.map((r) => ({ id: r.id, name: r.name, color: r.color })),
    // ادمین سرور همیشه همه‌ی بیت‌ها را دارد.
    permissions: row.is_admin
      ? ALL_PERMISSIONS
      : effectivePermissions(roles.map((r) => r.permissions)),
  };
}

export async function markPresence(userId: string, status: string) {
  await q(`update users set status = $2, last_seen_at = now() where id = $1`, [
    userId,
    status,
  ]).catch(() => {});
}
