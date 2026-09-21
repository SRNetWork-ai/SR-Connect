#!/usr/bin/env node
/**
 * بازنشانی گذرواژه‌ی یک کاربر از روی سرور.
 *
 * چرا اسکریپت و نه ایمیل: این سرور خودمیزبان است و سرویس ایمیل ندارد،
 * پس «لینک بازیابی» معنا ندارد. مدیر سرور با همین دستور گذرواژه را عوض می‌کند.
 *
 * استفاده:
 *   DATABASE_URL=… node scripts/reset-password.mjs <username|email> [password]
 * اگر گذرواژه ندهی، یک گذرواژه‌ی تصادفی امن ساخته و چاپ می‌شود.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const scrypt = promisify(scryptCb);
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 32;

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEYLEN, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL تنظیم نشده است.");
  process.exit(1);
}

const identity = (process.argv[2] ?? "").trim();
if (!identity) {
  console.error("استفاده: node scripts/reset-password.mjs <username|email> [password]");
  process.exit(1);
}

// گذرواژه‌ی تصادفی خوانا: حروف و رقم‌های بی‌ابهام.
function randomPassword() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const buf = randomBytes(18);
  return Array.from(buf, (b) => abc[b % abc.length]).join("") + "!7";
}

const password = process.argv[3] ?? randomPassword();
if (password.length < 10) {
  console.error("گذرواژه باید حداقل ۱۰ نویسه باشد.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
try {
  const found = await client.query(
    `select id, username from users where lower(username) = lower($1) or lower(email) = lower($1) limit 1`,
    [identity],
  );
  if (!found.rowCount) {
    console.error(`کاربری با «${identity}» پیدا نشد.`);
    process.exit(2);
  }
  const user = found.rows[0];
  await client.query(`update users set password_hash = $2 where id = $1`, [
    user.id,
    await hashPassword(password),
  ]);
  // همه‌ی نشست‌های باز باید بسته شوند، وگرنه گذرواژه‌ی عوض‌شده بی‌اثر است.
  const killed = await client.query(`delete from sessions where user_id = $1`, [user.id]);
  // دو پارامتر جدا، چون actor_id از نوع uuid و target از نوع text است.
  await client.query(
    `insert into audit_log (actor_id, action, target, meta)
     values ($1, 'user.password_reset', $2, $3::jsonb)`,
    [user.id, user.id, JSON.stringify({ via: "reset-password.mjs" })],
  );

  console.log(`گذرواژه‌ی «${user.username}» عوض شد.`);
  console.log(`گذرواژه‌ی جدید: ${password}`);
  console.log(`${killed.rowCount} نشست باز بسته شد.`);
} finally {
  await client.end();
}
// اطمینان از خروج، حتی اگر pool چیزی باز نگه داشته باشد.
process.exit(0);
