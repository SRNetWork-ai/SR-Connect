import pg from "pg";
import { env } from "./env.js";

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 6,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 8_000,
});

// بدون این هندلر، خطای یک کلاینتِ بی‌کار به‌صورت رویداد 'error' بدون شنونده
// بالا می‌آید و کل پروسه را می‌کشد — دقیقاً وقتی دیتابیس لحظه‌ای قطع شود.
pool.on("error", (err) => {
  console.error("[gateway] خطای استخر پستگرس:", err.message);
});

export async function q<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export type DbEvent =
  | { type: "message_create"; channelId: string; messageId: string }
  | { type: "message_update"; channelId: string; messageId: string }
  | { type: "message_delete"; channelId: string; messageId: string }
  | { type: "reaction_update"; channelId: string; messageId: string }
  | { type: "channels_changed" }
  | { type: "release_published"; version: string; mandatory: boolean };

/**
 * به کانال NOTIFY پستگرس گوش می‌دهد. اگر ارتباط قطع شود خودش
 * با backoff دوباره وصل می‌شود تا گیت‌وی بدون ری‌استارت زنده بماند.
 */
export function listenEvents(onEvent: (e: DbEvent) => void): () => void {
  let stopped = false;
  let client: pg.Client | null = null;
  let delay = 500;

  async function retry() {
    if (stopped) return;
    try {
      await client?.end();
    } catch {
      /* بی‌خیال */
    }
    client = null;
    const wait = delay;
    delay = Math.min(delay * 2, 15_000);
    setTimeout(() => void connect(), wait);
  }

  async function connect() {
    if (stopped) return;
    const c = new pg.Client({ connectionString: env.databaseUrl });
    client = c;
    c.on("notification", (msg) => {
      if (!msg.payload) return;
      try {
        onEvent(JSON.parse(msg.payload) as DbEvent);
      } catch {
        /* payload خراب را نادیده بگیر */
      }
    });
    c.on("error", () => void retry());
    try {
      await c.connect();
      await c.query("LISTEN sr_events");
      delay = 500;
      console.log("[gateway] به کانال رویدادهای پستگرس وصل شد");
    } catch (err) {
      console.error("[gateway] اتصال LISTEN شکست خورد:", (err as Error).message);
      void retry();
    }
  }

  void connect();
  return () => {
    stopped = true;
    void client?.end();
  };
}
