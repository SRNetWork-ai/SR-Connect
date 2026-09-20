import type { ChatMessage, Reaction } from "@sr/protocol";
import { q } from "./db.js";

/** ری‌اکشن‌های خام: لیست کاربرها نگه داشته می‌شود تا برای هر سوکت `me` را خودمان بسازیم. */
export interface ReactionUsers {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface LoadedMessage {
  message: ChatMessage;
  reactions: ReactionUsers[];
}

const SELECT = `
  select m.id,
         m.channel_id as "channelId",
         m.content,
         m.system,
         m.reply_to   as "replyTo",
         m.created_at as "createdAt",
         m.edited_at  as "editedAt",
         json_build_object(
           'id',          coalesce(u.id::text, 'system'),
           'username',    coalesce(u.username, 'system'),
           'displayName', coalesce(u.display_name, 'SR-Connect'),
           'avatarColor', coalesce(u.avatar_color, '#5865F2'),
           'avatarUrl',   u.avatar_url
         ) as author,
         coalesce(att.items, '[]'::json) as attachments,
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
   where m.id = $1 and m.deleted_at is null`;

export async function reactionUsers(messageId: string): Promise<ReactionUsers[]> {
  const rows = await q<{ emoji: string; count: string; user_ids: string[] }>(
    `select emoji, count(*)::int as count, array_agg(user_id::text) as user_ids
       from message_reactions where message_id = $1
      group by emoji order by min(created_at)`,
    [messageId],
  );
  return rows.map((r) => ({ emoji: r.emoji, count: Number(r.count), userIds: r.user_ids ?? [] }));
}

export async function loadMessage(messageId: string): Promise<LoadedMessage | null> {
  const [rows, reactions] = await Promise.all([
    q<ChatMessage>(SELECT, [messageId]),
    reactionUsers(messageId),
  ]);
  const message = rows[0];
  if (!message) return null;
  return { message: { ...message, reactions: [] }, reactions };
}

/** `me` را نسبت به بیننده حساب می‌کند. */
export function personalize(reactions: ReactionUsers[], viewerId: string): Reaction[] {
  return reactions.map((r) => ({
    emoji: r.emoji,
    count: r.count,
    me: r.userIds.includes(viewerId),
  }));
}
