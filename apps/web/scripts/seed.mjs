#!/usr/bin/env node
/**
 * داده‌ی اولیه‌ی یک سرور تازه: نقش‌ها، دسته‌ها، کانال‌ها و (اختیاری) کاربر مدیر.
 * چندبار اجرا شدنش بی‌خطر است (idempotent).
 *
 *   node scripts/seed.mjs
 *   ADMIN_USERNAME=ali ADMIN_PASSWORD='…' node scripts/seed.mjs
 */
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const scrypt = promisify(scryptCb);
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL تنظیم نشده است.");
  process.exit(1);
}

// همان پارامترها و قالب رشته‌ای که apps/web/src/lib/auth/password.ts استفاده می‌کند.
const N = 16384;
const r = 8;
const p = 1;
async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, 64, {
    N,
    r,
    p,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

// ماسک دسترسی‌ها — آینه‌ی packages/protocol/src/permissions.ts
const BITS = {
  VIEW_CHANNEL: 1 << 0,
  SEND_MESSAGE: 1 << 1,
  EMBED_LINKS: 1 << 2,
  ATTACH_FILES: 1 << 3,
  ADD_REACTION: 1 << 4,
  MENTION_EVERYONE: 1 << 5,
  MANAGE_MESSAGES: 1 << 6,
  CONNECT_VOICE: 1 << 7,
  SPEAK: 1 << 8,
  VIDEO: 1 << 9,
  SCREEN_SHARE: 1 << 10,
  PRIORITY_SPEAKER: 1 << 11,
  MUTE_MEMBERS: 1 << 12,
  MOVE_MEMBERS: 1 << 13,
  MANAGE_CHANNELS: 1 << 14,
  MANAGE_ROLES: 1 << 15,
  CREATE_INVITE: 1 << 16,
  MANAGE_UPDATES: 1 << 17,
  ADMINISTRATOR: 1 << 18,
};
const mask = (...names) => names.reduce((acc, n) => acc | BITS[n], 0);

const MEMBER = mask(
  "VIEW_CHANNEL",
  "SEND_MESSAGE",
  "EMBED_LINKS",
  "ATTACH_FILES",
  "ADD_REACTION",
  "CONNECT_VOICE",
  "SPEAK",
  "VIDEO",
  "SCREEN_SHARE",
);
const MODERATOR = MEMBER | mask("MANAGE_MESSAGES", "MUTE_MEMBERS", "MOVE_MEMBERS", "CREATE_INVITE");
const ADMIN = Object.values(BITS).reduce((a, b) => a | b, 0);

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

try {
  await client.query("begin");

  const roles = [
    ["ادمین", "#F23F43", ADMIN, 100, false],
    ["مدیر", "#F0B232", MODERATOR, 50, false],
    ["عضو", "#5865F2", MEMBER, 1, true],
  ];
  for (const [name, color, permissions, position, isDefault] of roles) {
    await client.query(
      `insert into roles (name, color, permissions, position, is_default)
       select $1, $2, $3, $4, $5
        where not exists (select 1 from roles where name = $1)`,
      [name, color, permissions, position, isDefault],
    );
  }

  for (const [name, position] of [
    ["گفت‌وگو", 1],
    ["اتاق‌های صوتی", 2],
  ]) {
    await client.query(
      `insert into categories (name, position)
       select $1, $2 where not exists (select 1 from categories where name = $1)`,
      [name, position],
    );
  }
  const catId = async (name) =>
    (await client.query(`select id from categories where name = $1`, [name])).rows[0]?.id ?? null;

  const chat = await catId("گفت‌وگو");
  const voice = await catId("اتاق‌های صوتی");

  const channels = [
    ["گفت‌وگوی-عمومی", "text", chat, "هرچه دوست داری اینجا بنویس", 1, 0],
    ["اعلان‌ها", "text", chat, "خبرهای مهم سرور", 2, 0],
    ["لابی", "voice", voice, null, 1, 20],
    ["بازی", "voice", voice, null, 2, 10],
    ["استیج", "stage", voice, "جلسه‌ی یک‌به‌چند", 3, 50],
  ];
  for (const [name, type, category, topic, position, userLimit] of channels) {
    await client.query(
      `insert into channels (name, type, category_id, topic, position, user_limit)
       select $1, $2, $3, $4, $5, coalesce(nullif($6, 0), 20)
        where not exists (select 1 from channels where name = $1)`,
      [name, type, category, topic, position, userLimit],
    );
  }

  await client.query(
    `insert into settings (key, value) values ('seeded', 'true'::jsonb)
     on conflict (key) do nothing`,
  );

  // کاربر مدیر — فقط اگر متغیرها داده شده باشند.
  const username = (process.env.ADMIN_USERNAME ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (username && password) {
    const exists = await client.query(`select id from users where username = $1`, [username]);
    if (exists.rows[0]) {
      console.log(`کاربر ${username} از قبل وجود دارد؛ رد شد.`);
    } else {
      const { rows } = await client.query(
        `insert into users (username, email, display_name, password_hash, avatar_color, is_admin)
         values ($1, $2, $3, $4, '#5865F2', true) returning id`,
        [
          username,
          process.env.ADMIN_EMAIL || null,
          process.env.ADMIN_DISPLAY_NAME || username,
          await hashPassword(password),
        ],
      );
      const adminRole = await client.query(`select id from roles where name = 'ادمین' limit 1`);
      if (adminRole.rows[0]) {
        await client.query(
          `insert into user_roles (user_id, role_id) values ($1, $2) on conflict do nothing`,
          [rows[0].id, adminRole.rows[0].id],
        );
      }
      console.log(`کاربر مدیر ${username} ساخته شد.`);
    }
  }

  await client.query("commit");
  console.log("داده‌ی اولیه آماده است: نقش‌ها، دسته‌ها و کانال‌ها.");
} catch (err) {
  await client.query("rollback");
  console.error("seed شکست خورد:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
