import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { one, q } from "@/lib/db/pool";
import { handle, requirePermission } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    await requirePermission("CREATE_INVITE");
    const invites = await q(
      `select i.code, i.max_uses as "maxUses", i.uses, i.expires_at as "expiresAt",
              i.created_at as "createdAt", u.display_name as "createdBy"
         from invites i left join users u on u.id = i.created_by
        order by i.created_at desc limit 50`,
    );
    return NextResponse.json({ invites });
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const user = await requirePermission("CREATE_INVITE");
    const body = (await req.json().catch(() => ({}))) as {
      maxUses?: number;
      expiresInHours?: number;
      roleId?: string | null;
    };

    const code = randomBytes(6).toString("base64url");
    const expires =
      body.expiresInHours && body.expiresInHours > 0
        ? new Date(Date.now() + body.expiresInHours * 3600_000)
        : null;

    const invite = await one(
      `insert into invites (code, created_by, role_id, max_uses, expires_at)
       values ($1, $2, $3, coalesce($4, 0), $5)
       returning code, max_uses as "maxUses", uses, expires_at as "expiresAt"`,
      [code, user.id, body.roleId ?? null, body.maxUses ?? null, expires],
    );

    return NextResponse.json({ invite }, { status: 201 });
  });
}
