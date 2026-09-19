import pg from "pg";
import { serverEnv } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var __srPool: pg.Pool | undefined;
}

/** یک Pool در کل پروسه — در dev هم بین hot-reloadها زنده می‌ماند. */
export const pool =
  globalThis.__srPool ??
  new pg.Pool({
    connectionString: serverEnv.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
  });

if (process.env.NODE_ENV !== "production") globalThis.__srPool = pool;

export async function q<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function one<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

/** تراکنش با rollback خودکار در صورت خطا. */
export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
