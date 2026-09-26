import { NextResponse } from "next/server";
import { q } from "@/lib/db/pool";
import { handle, requirePermission } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    await requirePermission("MANAGE_ROLES");
    const search = `%${new URL(req.url).searchParams.get("q")?.trim() ?? ""}%`;
    const members = await q(
      `select u.id, u.username, u.display_name as "displayName",
              u.avatar_color as "avatarColor", u.avatar_url as "avatarUrl",
              u.status, u.is_admin as "isAdmin", u.created_at as "createdAt",
              coalesce(json_agg(json_build_object('id', r.id, 'name', r.name, 'color', r.color))
                filter (where r.id is not null), '[]'::json) as roles
         from users u
         left join user_roles ur on ur.user_id = u.id
         left join roles r on r.id = ur.role_id
        where u.username ilike $1 or u.display_name ilike $1
        group by u.id order by u.display_name limit 200`,
      [search],
    );
    return NextResponse.json({ members });
  });
}
