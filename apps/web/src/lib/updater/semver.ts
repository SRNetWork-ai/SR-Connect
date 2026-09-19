/**
 * مقایسه‌ی semver بدون وابستگی بیرونی.
 * پشتیبانی: MAJOR.MINOR.PATCH[-pre.N]
 */

interface Parsed {
  core: [number, number, number];
  pre: (string | number)[];
}

export function parse(version: string): Parsed | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version.trim());
  if (!m) return null;
  return {
    core: [Number(m[1]), Number(m[2]), Number(m[3])],
    pre: m[4] ? m[4].split(".").map((p) => (/^\d+$/.test(p) ? Number(p) : p)) : [],
  };
}

/** خروجی: ۱ اگر a>b، ‎-۱ اگر a<b، ۰ اگر برابر. نسخه‌ی نامعتبر کوچک‌تر حساب می‌شود. */
export function compare(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;

  for (let i = 0; i < 3; i++) {
    if (pa.core[i] !== pb.core[i]) return pa.core[i] > pb.core[i] ? 1 : -1;
  }

  // نسخه‌ی پایدار از pre-release بالاتر است
  if (pa.pre.length === 0 && pb.pre.length > 0) return 1;
  if (pa.pre.length > 0 && pb.pre.length === 0) return -1;

  const len = Math.max(pa.pre.length, pb.pre.length);
  for (let i = 0; i < len; i++) {
    const x = pa.pre[i];
    const y = pb.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number") return x > y ? 1 : -1;
    return String(x) > String(y) ? 1 : -1;
  }
  return 0;
}

export const gt = (a: string, b: string) => compare(a, b) > 0;
export const lt = (a: string, b: string) => compare(a, b) < 0;
export const isValid = (v: string) => parse(v) !== null;
