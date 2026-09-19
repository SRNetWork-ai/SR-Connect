import { NextResponse } from "next/server";
import { ALL_PERMISSIONS } from "@sr/protocol";
import { one, q } from "@/lib/db/pool";
import { handle, HttpError, requirePermission } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    await requirePermission("MANAGE_ROLES");
    const roles = await q(
      `select r.id, r.name, r.color, r.permissions, r.position,
              r.is_default as "isDefault",
              (select count(*)::int from user_roles ur where ur.role_id = r.id) as members
         from roles r order by r.position desc, r.name`,
    );
    return NextResponse.json({ roles });
  });
}

export function POST(req: Request) {
  return handle(async () => {
    await requirePermission("MANAGE_ROLES");
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      color?: string;
      permissions?: number;
    };
    const name = (body.name ?? "").trim().slice(0, 32);
    if (!name) throw new HttpError(400, "نام نقش لازم است");

    const role = await one(
      `insert into roles (name, color, permissions, position)
       values ($1, coalesce($2, '#99AAB5'), $3, coalesce((select max(position) from roles), 0) + 1)
       returning id, name, color, permissions, position, is_default as "isDefault"`,
      [name, body.color ?? null, (body.permissions ?? 0) & ALL_PERMISSIONS],
    );
    return NextResponse.json({ role }, { status: 201 });
  });
}

export function PATCH(req: Request) {
  return handle(async () => {
    const actor = await requirePermission("MANAGE_ROLES");
    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      permissions?: number;
      name?: string;
      color?: string;
    };
    if (!body.id) throw new HttpError(400, "شناسه‌ی نقش لازم است");

    const role = await one(
      `update roles set
         permissions = coalesce($2, permissions),
         name        = coalesce($3, name),
         color       = coalesce($4, color)
       where id = $1
       returning id, name, color, permissions, position, is_default as "isDefault"`,
      [
        body.id,
        body.permissions === undefined ? null : body.permissions & ALL_PERMISSIONS,
        body.name ?? null,
        body.color ?? null,
      ],
    );
    if (!role) throw new HttpError(404, "نقش پیدا نشد");

    await q(`insert into audit_log (actor_id, action, target, meta) values ($1, 'role.update', $2, $3)`, [
      actor.id,
      body.id,
      JSON.stringify(body),
    ]);
    return NextResponse.json({ role });
  });
}
