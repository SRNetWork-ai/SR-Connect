import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(_scrypt) as (
  pw: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  opts: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// پارامترها در خود هش ذخیره می‌شوند تا بعداً بتوان سخت‌ترشان کرد.
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

/** خروجی: scrypt$N$r$p$saltB64$hashB64 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEYLEN, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, N, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64!, "base64");
  const got = await scrypt(
    password.normalize("NFKC"),
    Buffer.from(saltB64!, "base64"),
    expected.length,
    { N: Number(N), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem },
  );
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** بررسی حداقل‌های گذرواژه. پیام‌ها مستقیم به کاربر نشان داده می‌شوند. */
export function passwordProblems(password: string): string[] {
  const out: string[] = [];
  if (password.length < 10) out.push("حداقل ۱۰ نویسه");
  if (!/[a-zA-Z]/.test(password)) out.push("حداقل یک حرف");
  if (!/\d/.test(password)) out.push("حداقل یک رقم");
  return out;
}
