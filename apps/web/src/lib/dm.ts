import { one } from "@/lib/db/pool";
import { HttpError } from "@/lib/auth/guard";

/**
 * قوانین «چه کسی می‌تواند به من پیام/تماس بدهد» یک‌جا نگه داشته می‌شود تا
 * پیام خصوصی و تماس خصوصی هیچ‌وقت از هم جدا نیفتند.
 */
export async function requireDirectAccess(userId: string, peerId: string): Promise<void> {
  if (userId === peerId) throw new HttpError(400, "با خودت نمی‌شود");
  const preference = await one<{ allowDmFrom: string }>(
    `select coalesce(p.allow_dm_from, 'friends') as "allowDmFrom"
       from users u left join user_preferences p on p.user_id = u.id
      where u.id = $1`,
    [peerId],
  );
  if (!preference) throw new HttpError(404, "کاربر پیدا نشد");
  if (preference.allowDmFrom === "nobody") {
    throw new HttpError(403, "این کاربر پیام خصوصی را بسته است");
  }
  if (preference.allowDmFrom === "everyone") return;
  const friendship = await one(
    `select id from friendships
      where user_low = least($1::uuid, $2::uuid)
        and user_high = greatest($1::uuid, $2::uuid)
        and status = 'accepted'`,
    [userId, peerId],
  );
  if (!friendship) throw new HttpError(403, "این کاربر فقط از دوستان پیام می‌گیرد");
}

/** گفت‌وگوی خصوصی دو نفر؛ جفت کاربر همیشه مرتب‌شده ذخیره می‌شود. */
export async function conversation(
  userId: string,
  peerId: string,
  create: boolean,
): Promise<{ id: string } | null> {
  const found = await one<{ id: string }>(
    `select id from direct_conversations
      where user_low = least($1::uuid, $2::uuid)
        and user_high = greatest($1::uuid, $2::uuid)`,
    [userId, peerId],
  );
  if (found || !create) return found;
  return one<{ id: string }>(
    `insert into direct_conversations (user_low, user_high)
     values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid))
     on conflict (user_low, user_high) do update set user_low = excluded.user_low
     returning id`,
    [userId, peerId],
  );
}
