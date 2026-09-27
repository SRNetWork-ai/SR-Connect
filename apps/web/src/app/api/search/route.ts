import { NextResponse } from "next/server";
import { q } from "@/lib/db/pool";
import { channelPermissions, handle, requireUser } from "@/lib/auth/guard";
import { has } from "@sr/protocol";

export const dynamic = "force-dynamic";

interface Hit {
  id: string;
  channelId: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorColor: string;
}

/**
 * جست‌وجوی پیام.
 *
 * چرا ILIKE و نه full-text: محتوا فارسی است و پیکربندی پیش‌فرض tsvector
 * فارسی را ریشه‌یابی نمی‌کند، پس نتیجه‌اش از تطبیق ساده بدتر می‌شد.
 * برای حجم یک سرور خودی، ILIKE با سقف نتیجه کافی و قابل پیش‌بینی است.
 *
 * دسترسی: نتایج بعد از خواندن، بر اساس مجوز واقعی همان کانال غربال می‌شوند
 * تا کانال خصوصی از این مسیر لو نرود.
 */
export function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const term = (url.searchParams.get("q") ?? "").trim();

    if (term.length < 2) return NextResponse.json({ hits: [], term });

    const rows = await q<Hit>(
      `select m.id,
              m.channel_id as "channelId",
              m.content,
              m.created_at as "createdAt",
              coalesce(u.display_name, 'SR-Connect') as "authorName",
              coalesce(u.avatar_color, '#5865F2')    as "authorColor"
         from messages m
         left join users u on u.id = m.author_id
        where m.deleted_at is null
          and m.system = false
          and m.content ilike '%' || $1 || '%'
        order by m.created_at desc
        limit 80`,
      [term],
    );

    // یک‌بار برای هر کانال مجوز می‌گیریم، نه برای هر پیام.
    const allowed = new Map<string, boolean>();
    const hits: Hit[] = [];
    for (const row of rows) {
      if (!allowed.has(row.channelId)) {
        const mask = user.isAdmin ? null : await channelPermissions(user, row.channelId);
        allowed.set(row.channelId, mask === null ? true : has(mask, "VIEW_CHANNEL"));
      }
      if (allowed.get(row.channelId)) hits.push(row);
      if (hits.length >= 30) break;
    }

    return NextResponse.json({ hits, term });
  });
}
