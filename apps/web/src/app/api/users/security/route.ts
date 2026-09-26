import { NextResponse } from "next/server";
import { one, q } from "@/lib/db/pool";
import { handle, HttpError, requireUser } from "@/lib/auth/guard";
import { hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";

export const dynamic = "force-dynamic";

export function PATCH(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as {
      currentPassword?: string;
      newPassword?: string;
    };
    const currentPassword = body.currentPassword ?? "";
    const newPassword = body.newPassword ?? "";
    const row = await one<{ passwordHash: string }>(
      `select password_hash as "passwordHash" from users where id = $1`,
      [user.id],
    );
    if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) {
      throw new HttpError(403, "رمز فعلی درست نیست");
    }
    const problems = passwordProblems(newPassword);
    if (problems.length) throw new HttpError(400, problems.join("، "));
    await q(`update users set password_hash = $1 where id = $2`, [
      await hashPassword(newPassword),
      user.id,
    ]);
    // پس از تغییر رمز، همه‌ی نشست‌ها باطل می‌شوند و کاربر دوباره وارد می‌شود.
    await q(`delete from sessions where user_id = $1`, [user.id]);
    return NextResponse.json({ ok: true });
  });
}
