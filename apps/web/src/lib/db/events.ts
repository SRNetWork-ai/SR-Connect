import { q } from "@/lib/db/pool";

/**
 * اپ وب و گیت‌وی دو پروسه‌ی جدا هستند.
 * برای اینکه پیام تازه فوراً به سوکت‌ها برسد از LISTEN/NOTIFY پستگرس
 * استفاده می‌کنیم؛ نه صف جدا لازم است نه Redis.
 */
export type DbEvent =
  | { t: "message_create"; channelId: string; messageId: string }
  | { t: "message_delete"; channelId: string; messageId: string }
  | { t: "channels_changed" }
  | { t: "release_published"; version: string; mandatory: boolean };

export async function notify(event: DbEvent): Promise<void> {
  // payload کوچک می‌ماند؛ گیت‌وی خود ردیف را از دیتابیس می‌خواند.
  const payload = JSON.stringify({ ...event, type: event.t });
  await q(`select pg_notify('sr_events', $1)`, [payload]).catch((err) => {
    console.warn("[events] pg_notify ناموفق بود:", (err as Error).message);
  });
}
