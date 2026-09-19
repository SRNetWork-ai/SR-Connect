type ClassValue = string | number | bigint | boolean | null | undefined | ClassValue[];

/** چسباندن کلاس‌ها بدون وابستگی بیرونی. */
export function cn(...parts: ClassValue[]): string {
  const out: string[] = [];
  for (const p of parts) {
    if (!p) continue;
    if (Array.isArray(p)) {
      const nested = cn(...p);
      if (nested) out.push(nested);
    } else out.push(String(p));
  }
  return out.join(" ");
}
