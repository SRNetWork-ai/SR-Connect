const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** تبدیل ارقام لاتین به فارسی برای نمایش (مقادیر منطقی همیشه لاتین می‌مانند). */
export function fa(value: string | number): string {
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function bytes(n: number): string {
  if (n < 1024) return `${fa(n)} بایت`;
  if (n < 1024 * 1024) return `${fa((n / 1024).toFixed(0))} کیلوبایت`;
  return `${fa((n / 1024 / 1024).toFixed(1))} مگابایت`;
}

export function ms(n: number): string {
  return n < 1000 ? `${fa(n)} م‌ث` : `${fa((n / 1000).toFixed(1))} ثانیه`;
}

export function pct(n: number): string {
  return `${fa(Math.round(n))}٪`;
}

/**
 * تاریخ کوتاه برای فهرست‌ها و نتایج جست‌وجو.
 * پیام امروز فقط ساعت می‌گیرد؛ قدیمی‌تر روز و ماه. هر دو شمسی.
 */
export function faDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const sameDay = date.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat(
    "fa-IR",
    sameDay ? { hour: "2-digit", minute: "2-digit" } : { month: "short", day: "numeric" },
  ).format(date);
}
