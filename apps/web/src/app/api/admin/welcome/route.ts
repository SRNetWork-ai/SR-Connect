import { NextResponse } from "next/server";
import { q } from "@/lib/db/pool";
import { handle, requirePermission } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { loadWelcome, sanitizeWelcome, type WelcomeScreen } from "@/lib/welcome";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    await requirePermission("MANAGE_CHANNELS");
    return NextResponse.json({ welcome: await loadWelcome() });
  });
}

export function PATCH(req: Request) {
  return handle(async () => {
    const actor = await requirePermission("MANAGE_CHANNELS");
    const body = (await req.json().catch(() => ({}))) as Partial<WelcomeScreen>;
    const welcome = sanitizeWelcome(body, await loadWelcome());
    await q(
      `insert into settings (key, value) values ('welcome_screen', $1::jsonb)
       on conflict (key) do update set value = excluded.value`,
      [JSON.stringify(welcome)],
    );
    await audit(actor.id, "server.welcome.update", "server", { enabled: welcome.enabled });
    return NextResponse.json({ welcome });
  });
}
