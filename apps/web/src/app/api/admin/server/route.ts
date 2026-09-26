import { NextResponse } from "next/server";
import { one, q } from "@/lib/db/pool";
import { handle, HttpError, requirePermission } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
const DEFAULTS = {
  name: "SR-Connect",
  bio: "",
  profileUrl: "",
  backgroundColor: "#5865F2",
  visibility: "private",
  welcomeTitle: "به سرور خوش آمدی",
  welcomeMessage: "",
};

export function GET() {
  return handle(async () => {
    await requirePermission("MANAGE_CHANNELS");
    const row = await one<{ value: typeof DEFAULTS }>(
      `select value from settings where key = 'server_profile'`,
    );
    return NextResponse.json({ profile: { ...DEFAULTS, ...(row?.value ?? {}) } });
  });
}

export function PATCH(req: Request) {
  return handle(async () => {
    const actor = await requirePermission("MANAGE_CHANNELS");
    const body = (await req.json().catch(() => ({}))) as Partial<typeof DEFAULTS>;
    if (body.visibility && !["public", "private"].includes(body.visibility)) {
      throw new HttpError(400, "نوع سرور نامعتبر است");
    }
    const current = await one<{ value: typeof DEFAULTS }>(
      `select value from settings where key = 'server_profile'`,
    );
    const profile = {
      ...DEFAULTS,
      ...(current?.value ?? {}),
      ...body,
      name: (body.name ?? current?.value.name ?? DEFAULTS.name).trim().slice(0, 64),
      bio: (body.bio ?? current?.value.bio ?? "").trim().slice(0, 500),
    };
    await q(
      `insert into settings (key, value) values ('server_profile', $1::jsonb)
       on conflict (key) do update set value = excluded.value`,
      [JSON.stringify(profile)],
    );
    await q(
      `insert into audit_log (actor_id, action, target, meta)
       values ($1, 'server.profile.update', 'server', $2::jsonb)`,
      [actor.id, JSON.stringify(profile)],
    );
    return NextResponse.json({ profile });
  });
}
