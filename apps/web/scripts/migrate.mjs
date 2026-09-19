#!/usr/bin/env node
/**
 * مهاجرت ساده و ترتیبی. هر فایل .sql یک‌بار اجرا می‌شود و نامش
 * در جدول schema_migrations ثبت می‌گردد. دوباره اجرا کردن بی‌خطر است.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(here, "..", "src", "lib", "db", "migrations");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL تنظیم نشده است.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 10_000 });
try {
  await client.connect();
} catch (err) {
  console.error(`اتصال به دیتابیس ممکن نشد: ${err.message}`);
  console.error(`DATABASE_URL = ${DATABASE_URL.replace(/:[^:@/]+@/, ":***@")}`);
  console.error("اگر پیام timeout است، کانتینر به postgres دسترسی شبکه‌ای ندارد.");
  process.exit(1);
}

try {
  await client.query(`create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`);

  const applied = new Set(
    (await client.query(`select name from schema_migrations`)).rows.map((r) => r.name),
  );
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(dir, file), "utf8");
    process.stdout.write(`→ ${file} … `);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(`insert into schema_migrations (name) values ($1)`, [file]);
      await client.query("commit");
      console.log("انجام شد");
      count += 1;
    } catch (err) {
      await client.query("rollback");
      console.log("شکست خورد");
      throw err;
    }
  }
  console.log(count ? `${count} مهاجرت اعمال شد.` : "دیتابیس از قبل به‌روز است.");
} catch (err) {
  console.error("مهاجرت ناموفق:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
