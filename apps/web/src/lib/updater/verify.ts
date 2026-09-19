import { getUpdatePubkey } from "@/lib/runtime-config";

export type SignatureResult =
  | { ok: true; algorithm: "Ed25519" }
  | { ok: false; reason: "bad-signature" }
  | { ok: false; reason: "unsupported"; detail: string };

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** هش SHA-256 بایت‌های دانلودشده. */
export async function sha256(data: BufferSource): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", data));
}

/**
 * بررسی امضای Ed25519 روی هشِ بسته.
 * کلید عمومی در خود کلاینت پین شده؛ بنابراین حتی اگر سرور آپدیت لو برود،
 * نمی‌تواند بسته‌ی دست‌کاری‌شده را جا بزند.
 */
export async function verifySignature(
  sha256Hex: string,
  signatureB64: string,
): Promise<SignatureResult> {
  const message = new TextEncoder().encode(sha256Hex);
  // کلید از سرور خوانده می‌شود تا ایمیج آماده هم بتواند امضا را درست بررسی کند.
  const pubkey = await getUpdatePubkey();

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      b64ToBytes(pubkey) as unknown as ArrayBuffer,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      b64ToBytes(signatureB64) as unknown as ArrayBuffer,
      message as unknown as ArrayBuffer,
    );
    return ok ? { ok: true, algorithm: "Ed25519" } : { ok: false, reason: "bad-signature" };
  } catch (err) {
    // بعضی محیط‌ها (سافاری قدیمی، وب‌ویو) Ed25519 ندارند.
    // اینجا به‌جای نصب کورکورانه، نتیجه را «قابل بررسی نیست» اعلام می‌کنیم
    // و تصمیم نصب به سیاست کانال سپرده می‌شود.
    return {
      ok: false,
      reason: "unsupported",
      detail: (err as Error)?.message ?? "WebCrypto Ed25519 در دسترس نیست",
    };
  }
}

export async function verifyArtifact(
  bytes: Uint8Array,
  expectedSha256: string,
  signatureB64: string,
): Promise<{ hashOk: boolean; hash: string; signature: SignatureResult }> {
  const hash = await sha256(bytes as unknown as ArrayBuffer);
  const hashOk = hash === expectedSha256.toLowerCase();
  const signature = hashOk
    ? await verifySignature(hash, signatureB64)
    : ({ ok: false, reason: "bad-signature" } as SignatureResult);
  return { hashOk, hash, signature };
}
