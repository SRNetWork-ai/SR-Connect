import { NextResponse } from "next/server";
import type { Category, Channel, ReadState } from "@sr/protocol";
import { q } from "@/lib/db/pool";
import { serverEnv } from "@/lib/env";
import { handle, requireUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/**
 * یک درخواست برای بالا آمدن اپ: کاربر، دسته‌ها، کانال‌ها، اعضا، آمار و خوانده‌نشده‌ها.
 * هدف: بعد از اسپلش، اپ با یک round-trip قابل استفاده شود.
 */
export function GET() {
  return handle(async () => {
    const user = await requireUser();

    const [categories, channels, members, stats, readState] = await Promise.all([
      q<Category>(`select id, name, position from categories order by position, name`),
      q<Channel>(
        `select id, category_id as "categoryId", name, type, topic, position,
                is_private as "isPrivate", user_limit as "userLimit", bitrate
           from channels order by position, name`,
      ),
      q(
        `select u.id, u.username, u.display_name as "displayName",
                u.avatar_color as "avatarColor", u.avatar_url as "avatarUrl", u.bio,
                u.status, u.is_admin as "isAdmin",
                u.last_seen_at as "lastSeenAt",
                '[]'::json as roles
           from users u order by u.display_name limit 200`,
      ),
      q<{ members: number; online: number }>(
        `select count(*)::int as members,
                count(*) filter (where status <> 'offline')::int as online
           from users`,
      ),
      // شمارش خوانده‌نشده‌ها فقط برای کانال‌های متنی؛ سقف ۹۹ تا کوئری سبک بماند.
      q<ReadState>(
        `select c.id as "channelId",
                rs.last_read_at as "lastReadAt",
                (select count(*)::int from messages m
                  where m.channel_id = c.id
                    and m.deleted_at is null
                    and m.author_id is distinct from $1
                    and m.created_at > coalesce(rs.last_read_at, to_timestamp(0))) as unread,
                (select count(*)::int from mentions mn
                  where mn.channel_id = c.id and mn.user_id = $1 and mn.seen = false) as mentions
           from channels c
           left join read_state rs on rs.channel_id = c.id and rs.user_id = $1
          where c.type = 'text'`,
        [user.id],
      ),
    ]);

    return NextResponse.json({
      user,
      categories,
      channels,
      members,
      readState,
      stats: {
        ...(stats[0] ?? { members: 0, online: 0 }),
        voiceCapacity: serverEnv.voiceCapacity,
        uptimeSeconds: Math.round(process.uptime()),
      },
      features: {
        voice: Boolean(serverEnv.livekit.publicUrl),
        registration: serverEnv.allowRegistration,
        requireInvite: serverEnv.requireInvite,
        uploads: true,
      },
    });
  });
}
