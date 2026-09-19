import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE } from "@/lib/auth/session";
import { handle } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export function POST() {
  return handle(async () => {
    const jar = await cookies();
    await destroySession(jar.get(SESSION_COOKIE)?.value);
    const res = NextResponse.json({ ok: true });
    res.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
    return res;
  });
}
