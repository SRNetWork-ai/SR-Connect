function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`متغیر محیطی ${name} تنظیم نشده است`);
  return v;
}

export const env = {
  port: Number(process.env.GATEWAY_PORT ?? 4001),
  host: process.env.GATEWAY_HOST ?? "0.0.0.0",
  databaseUrl: req("DATABASE_URL"),
  /** حداقل نسخه‌ی کلاینتی که اجازه‌ی اتصال دارد (آپدیت اجباری). */
  minClientVersion: process.env.MIN_CLIENT_VERSION ?? "0.0.0",
  latestVersion: process.env.APP_VERSION ?? "1.0.0",
  mandatoryUpdate: process.env.UPDATE_MANDATORY === "1",
  trustProxy: process.env.GATEWAY_TRUST_PROXY !== "0",
};
