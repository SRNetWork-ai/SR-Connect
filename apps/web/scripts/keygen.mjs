#!/usr/bin/env node
/**
 * تولید جفت‌کلید Ed25519 برای امضای بسته‌های آپدیت.
 *   node scripts/keygen.mjs            → چاپ در خروجی
 *   node scripts/keygen.mjs ./dev-keys → ذخیره در پوشه
 * کلید خصوصی هیچ‌وقت نباید در مخزن گیت برود.
 */
import { generateKeyPairSync } from "node:crypto";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");

// ۳۲ بایت خام — همان چیزی که WebCrypto در کلاینت می‌خواهد.
const rawPublic = publicKey.export({ type: "spki", format: "der" }).subarray(-32);
const pubB64 = rawPublic.toString("base64");
const privPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const dir = process.argv[2];
if (dir) {
  const out = resolve(dir);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "update-signing.key"), privPem, { mode: 0o600 });
  writeFileSync(join(out, "update-signing.pub"), pubB64 + "\n");
  chmodSync(join(out, "update-signing.key"), 0o600);
  console.error(`کلیدها در ${out} نوشته شد.`);
} else {
  console.log(privPem);
}

console.log(pubB64);
console.error("\n# کلید عمومی (در .env هر دو طرف):");
console.error(`NEXT_PUBLIC_UPDATE_PUBKEY=${pubB64}`);
console.error("# کلید خصوصی را فقط روی سرور یا در GitHub Secrets نگه دار.");
