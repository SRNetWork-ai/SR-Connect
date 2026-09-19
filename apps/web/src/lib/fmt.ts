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
