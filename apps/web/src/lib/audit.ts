import { q } from "@/lib/db/pool";

/** ثبت رویداد مدیریتی. هیچ‌وقت نباید مسیر اصلی را بشکند، پس خطا را می‌بلعد. */
export async function audit(
  actorId: string | null,
  action: string,
  target?: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  await q(`insert into audit_log (actor_id, action, target, meta) values ($1, $2, $3, $4::jsonb)`, [
    actorId,
    action,
    target ?? null,
    JSON.stringify(meta ?? {}),
  ]).catch((err) => console.warn("[audit]", (err as Error).message));
}
