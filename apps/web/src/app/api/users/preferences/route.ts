import { NextResponse } from "next/server";
import { one } from "@/lib/db/pool";
import { handle, HttpError, requireUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

interface Preferences {
  allowDmFrom: "everyone" | "friends" | "nobody";
  notifyMessages: boolean;
  notifyMentions: boolean;
  notifyCalls: boolean;
  theme: "dark" | "midnight" | "contrast";
}

const SELECT = `select allow_dm_from as "allowDmFrom",
                       notify_messages as "notifyMessages",
                       notify_mentions as "notifyMentions",
                       notify_calls as "notifyCalls",
                       theme
                  from user_preferences where user_id = $1`;

async function ensure(userId: string) {
  await one(
    `insert into user_preferences (user_id) values ($1)
     on conflict (user_id) do update set user_id = excluded.user_id returning user_id`,
    [userId],
  );
}

export function GET() {
  return handle(async () => {
    const user = await requireUser();
    await ensure(user.id);
    return NextResponse.json({ preferences: await one<Preferences>(SELECT, [user.id]) });
  });
}

export function PATCH(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as Partial<Preferences>;
    const sets: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if (body.allowDmFrom !== undefined) {
      if (!["everyone", "friends", "nobody"].includes(body.allowDmFrom)) {
        throw new HttpError(400, "تنظیم پیوی نامعتبر است");
      }
      add("allow_dm_from", body.allowDmFrom);
    }
    if (body.notifyMessages !== undefined) add("notify_messages", Boolean(body.notifyMessages));
    if (body.notifyMentions !== undefined) add("notify_mentions", Boolean(body.notifyMentions));
    if (body.notifyCalls !== undefined) add("notify_calls", Boolean(body.notifyCalls));
    if (body.theme !== undefined) {
      if (!["dark", "midnight", "contrast"].includes(body.theme)) {
        throw new HttpError(400, "تم نامعتبر است");
      }
      add("theme", body.theme);
    }
    if (!sets.length) throw new HttpError(400, "تنظیمی برای تغییر ارسال نشده");

    await ensure(user.id);
    values.push(user.id);
    const preferences = await one<Preferences>(
      `update user_preferences set ${sets.join(", ")}, updated_at = now()
        where user_id = $${values.length}
        returning allow_dm_from as "allowDmFrom",
                  notify_messages as "notifyMessages",
                  notify_mentions as "notifyMentions",
                  notify_calls as "notifyCalls", theme`,
      values,
    );
    return NextResponse.json({ preferences });
  });
}
