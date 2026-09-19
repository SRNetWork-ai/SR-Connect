#!/usr/bin/env node
/**
 * انتشار یک نسخه: آرتیفکت را هش و امضا می‌کند، در RELEASES_DIR می‌گذارد و
 * ردیف ریلیز را در دیتابیس می‌نویسد. همین ردیف منبع حقیقتِ /api/version است.
 *
 *   node scripts/sign-release.mjs --version 1.0.1 --file out/sr-connect-1.0.1.zip \
 *        --channel stable --min-client 1.0.0 --notes "…" [--mandatory] [--rollout 25]
 *
 * لازم: UPDATE_SIGNING_KEY (PEM یا base64 از PEM). DATABASE_URL اختیاری است.
 */
import { createHash, createPrivateKey, sign as cryptoSign } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import pg from "pg";

function parseArgs(argv) {
  const out = { notes: [] };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    if (key === "mandatory") out.mandatory = true;
    else if (key === "notes") out.notes.push(argv[++i]);
    else out[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i];
  }
  return out;
}

const opts = parseArgs(process.argv);
const fail = (m) => {
  console.error(m);
  process.exit(1);
};

if (!opts.version) fail("--version لازم است");
if (!opts.file) fail("--file لازم است (آرتیفکت ساخته‌شده)");

const keyRaw = process.env.UPDATE_SIGNING_KEY;
if (!keyRaw) fail("UPDATE_SIGNING_KEY تنظیم نشده است");
const pem = keyRaw.includes("BEGIN") ? keyRaw : Buffer.from(keyRaw, "base64").toString("utf8");
const privateKey = createPrivateKey(pem);

const filePath = resolve(opts.file);
const bytes = readFileSync(filePath);
const size = statSync(filePath).size;
const sha256 = createHash("sha256").update(bytes).digest("hex");
// امضا روی رشته‌ی hex هش زده می‌شود — همان چیزی که کلاینت در verify.ts بررسی می‌کند.
const sig = cryptoSign(null, Buffer.from(sha256, "utf8"), privateKey).toString("base64");

const releasesDir = resolve(process.env.RELEASES_DIR ?? "./releases");
mkdirSync(releasesDir, { recursive: true });
const artifactName = `sr-connect-${opts.version}.zip`;
copyFileSync(filePath, join(releasesDir, artifactName));

const artifact = { url: `/api/artifact/${artifactName}`, size, sha256, sig };
const channel = opts.channel ?? "stable";
const minClient = opts.minClient ?? "0.0.0";
const rollout = opts.rollout === undefined ? 100 : Number(opts.rollout);
const apiVersion = Number(opts.apiVersion ?? 3);

console.log(`نسخه ${opts.version} · ${(size / 1024).toFixed(0)} کیلوبایت`);
console.log(`sha256 = ${sha256}`);
console.log(`sig    = ${sig.slice(0, 24)}…`);

if (!process.env.DATABASE_URL) {
  console.log("\nDATABASE_URL نیست؛ فقط آرتیفکت و امضا ساخته شد (حالت CI).");
  console.log(JSON.stringify({ version: opts.version, channel, minClient, artifact }, null, 2));
  process.exit(0);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(
    `insert into releases
       (version, channel, min_client, api_version, mandatory, rollout, notes, artifacts, published_at)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, now())
     on conflict (version) do update set
       channel = excluded.channel,
       min_client = excluded.min_client,
       api_version = excluded.api_version,
       mandatory = excluded.mandatory,
       rollout = excluded.rollout,
       notes = excluded.notes,
       artifacts = excluded.artifacts,
       published_at = now(),
       yanked = false`,
    [
      opts.version,
      channel,
      minClient,
      apiVersion,
      Boolean(opts.mandatory),
      Number.isFinite(rollout) ? Math.max(0, Math.min(100, rollout)) : 100,
      JSON.stringify(opts.notes.length ? opts.notes : ["به‌روزرسانی نگهداری"]),
      JSON.stringify({ full: artifact }),
    ],
  );
  await client.query(`select pg_notify('sr_events', $1)`, [
    JSON.stringify({
      type: "release_published",
      version: opts.version,
      mandatory: Boolean(opts.mandatory),
    }),
  ]);
  console.log(`\nریلیز ${opts.version} در دیتابیس ثبت و به کلاینت‌ها اعلام شد.`);
} finally {
  await client.end();
}
