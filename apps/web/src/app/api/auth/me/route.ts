import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/auth/guard";
import { listPermissions } from "@sr/protocol";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const user = await requireUser();
    return NextResponse.json({ user, permissions: listPermissions(user.permissions) });
  });
}
