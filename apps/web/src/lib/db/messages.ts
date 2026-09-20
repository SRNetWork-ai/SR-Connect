import type { ChatMessage } from "@sr/protocol";
import { one, q } from "@/lib/db/pool";

/**
 * یک select مشترک برای همه‌ی مسیرهایی که پیام برمی‌گردانند.
 * ری‌اکشن‌ها و پیوست‌ها با lateral join جمع می‌شوند تا N+1 نداشته باشیم.
 */
export const MESSAGE_SELECT = `
  select m.id,
         m.channel_id as "channelId",
         m.content,
         m.system,
         m.reply_to  as "replyTo",
         m.created_at as "createdAt",
         m.edited_at  as "editedAt",
         json_build_object(
           'id',          coalesce(u.id::text, 'system'),
           'username',    coalesce(u.username, 'system'),
           'displayName', coalesce(u.display_name, 'SR-Connect'),
           'avatarColor', coalesce(u.avatar_color, '#5865F2'),
           'avatarUrl',   u.avatar_url
         ) as author,
         coalesce(att.items, '[]'::json)  as attachments,
         coalesce(rx.items,  '[]'::json)  as reactions,
         case when rm.id is null then null else json_build_object(
           'id',          rm.id,
           'authorName',  coalesce(ru.display_name, 'SR-Connect'),
           'authorColor', coalesce(ru.avatar_color, '#5865F2'),
           'excerpt',     left(coalesce(rm.content, ''), 140),
           'deleted',     rm.deleted_at is not null
         ) end as "replyPreview"
    from messages m
    left join users u on u.id = m.author_id
    left join messages rm on rm.id = m.reply_to
    left join users ru on ru.id = rm.author_id
    left join lateral (
      select json_agg(json_build_object(
               'id', a.id, 'filename', a.filename, 'size', a.size,
               'mime', a.mime, 'url', '/api/files/' || a.path,
               'width', a.width, 'height', a.height
             ) order by a.created_at) as items
        from attachments a where a.message_id = m.id
    ) att on true
    left join lateral (
      select json_agg(json_build_object(
               'emoji', e.emoji, 'count', e.n, 'me', e.mine
             ) order by e.first_at) as items
        from (
          select r.emoji,
                 count(*)::int as n,
                 bool_or(r.user_id = $VIEWER) as mine,
                 min(r.created_at) as first_at
            from message_reactions r
           where r.message_id = m.id
           group by r.emoji
        ) e
    ) rx on true`;

/** viewerId باید همیشه پارامتر $1 باشد. */
export function messageQuery(where: string): string {
  return `${MESSAGE_SELECT.replace(/\$VIEWER/g, "$1")} ${where}`;
}

export async function loadMessage(
  viewerId: string,
  messageId: string,
): Promise<ChatMessage | null> {
  return (await one<ChatMessage>(messageQuery(`where m.id = $2`), [viewerId, messageId])) ?? null;
}

export async function loadReactions(viewerId: string, messageId: string) {
  return q<{ emoji: string; count: number; me: boolean }>(
    `select r.emoji,
            count(*)::int as count,
            bool_or(r.user_id = $1) as me
       from message_reactions r
      where r.message_id = $2
      group by r.emoji
      order by min(r.created_at)`,
    [viewerId, messageId],
  );
}
