import { createPrivateKey, sign as edSign } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { serverEnv } from "@/lib/env";

/**
 * کلید خصوصی Ed25519 فقط روی سرور است و هرگز در گیت نمی‌رود.
 * ترتیب جست‌وجو: متغیر محیطی (PEM یا base64) → فایل توسعه.
 */
function privateKeyPem(): string | null {
  const inline = serverEnv.updates.signingKey;
  if (inline) {
    return inline.includes("BEGIN")
      ? inline.replace(/\\n/g, "\n")
      : Buffer.from(inline, "base64").toString("utf8");
  }
  try {
    return readFileSync(path.join(process.cwd(), "dev-keys/update-signing.dev.pem"), "utf8");
  } catch {
    return null;
  }
}

export function canSign(): boolean {
  return privateKeyPem() !== null;
}

/** امضای Ed25519 روی رشته‌ی هکسِ SHA-256 — دقیقاً همان چیزی که کلاینت بررسی می‌کند. */
export function signHash(sha256Hex: string): string {
  const pem = privateKeyPem();
  if (!pem) return "";
  try {
    return edSign(null, Buffer.from(sha256Hex, "utf8"), createPrivateKey(pem)).toString("base64");
  } catch (err) {
    console.error("[signing] امضا ناموفق بود:", (err as Error).message);
    return "";
  }
}
