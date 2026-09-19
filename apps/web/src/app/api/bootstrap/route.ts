import { NextResponse } from "next/server";
import type { Category, Channel } from "@sr/protocol";
import { q } from "@/lib/db/pool";
import { serverEnv } from "@/lib/env";
import { handle, requireUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/**
 * یک درخواست برای بالا آمدن اپ: کاربر، دسته‌ها، کانال‌ها، اعضا و آمار.
 * هدف: بعد از اسپلش، اپ با یک round-trip قابل استفاده شود.
 */
export function GET() {
  return handle(async () => {
    const user = await requireUser();

    const [categories, channels, members, stats] = await Promise.all([
      q<Category>(`select id, name, position from categories order by position, name`),
      q<Channel>(
        `select id, category_id as "categoryId", name, type, topic, position,
                is_private as "isPrivate", user_limit as "userLimit", bitrate
           from channels order by position, name`,
      ),
      q(
        `select u.id, u.username, u.display_name as "displayName",
                u.avatar_color as "avatarColor", u.status, u.is_admin as "isAdmin",
                u.last_seen_at as "lastSeenAt",
                '[]'::json as roles
           from users u order by u.display_name limit 200`,
      ),
      q<{ members: number; online: number }>(
        `select count(*)::int as members,
                count(*) filter (where status <> 'offline')::int as online
           from users`,
      ),
    ]);

    return NextResponse.json({
      user,
      categories,
      channels,
      members,
      stats: {
        ...(stats[0] ?? { members: 0, online: 0 }),
        voiceCapacity: serverEnv.voiceCapacity,
        uptimeSeconds: Math.round(process.uptime()),
      },
      features: {
        voice: Boolean(serverEnv.livekit.publicUrl),
        registration: serverEnv.allowRegistration,
        requireInvite: serverEnv.requireInvite,
      },
    });
  });
}
