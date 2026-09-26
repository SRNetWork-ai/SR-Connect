import { NextResponse } from "next/server";
import { one } from "@/lib/db/pool";
import { handle, HttpError, requireUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const LEVELS = ["all", "mentions", "nothing"] as const;
type Level = (typeof LEVELS)[number];

interface Prefs {
  level: Level;
  suppressEveryone: boolean;
  muteUntil: string | null;
}

const DEFAULTS: Prefs = { level: "all", suppressEveryone: false, muteUntil: null };

export function GET() {
  return handle(async () => {
    const user = await requireUser();
    const row = await one<Prefs>(
      `select level, suppress_everyone as "suppressEveryone", mute_until as "muteUntil"
         from server_notification_prefs where user_id = $1`,
      [user.id],
    );
    return NextResponse.json({ notifications: row ?? DEFAULTS });
  });
}

export function PATCH(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as Partial<Prefs>;
    if (body.level && !LEVELS.includes(body.level)) {
      throw new HttpError(400, "سطح اعلان نامعتبر است");
    }
    const row = await one<Prefs>(
      `insert into server_notification_prefs (user_id, level, suppress_everyone, mute_until)
       values ($1, coalesce($2, 'all'), coalesce($3, false), $4)
       on conflict (user_id) do update set
         level = coalesce($2, server_notification_prefs.level),
         suppress_everyone = coalesce($3, server_notification_prefs.suppress_everyone),
         mute_until = $4,
         updated_at = now()
       returning level, suppress_everyone as "suppressEveryone", mute_until as "muteUntil"`,
      [user.id, body.level ?? null, body.suppressEveryone ?? null, body.muteUntil ?? null],
    );
    return NextResponse.json({ notifications: row ?? DEFAULTS });
  });
}
