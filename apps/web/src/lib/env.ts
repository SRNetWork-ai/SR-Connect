/** پیکربندی سمت سرور. همه‌چیز از محیط می‌آید تا ایمیج یکسان روی هر سروری بالا بیاید. */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

function need(name: string, fallback = ""): string {
  const v = process.env[name] ?? fallback;
  if (!v && !isBuildPhase && process.env.NODE_ENV === "production") {
    console.warn(`[env] ${name} تنظیم نشده است`);
  }
  return v;
}

export const serverEnv = {
  databaseUrl: need("DATABASE_URL"),
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 30),
  allowRegistration: process.env.ALLOW_REGISTRATION !== "0",
  requireInvite: process.env.REQUIRE_INVITE === "1",
  livekit: {
    url: process.env.LIVEKIT_URL ?? "",
    apiKey: process.env.LIVEKIT_API_KEY ?? "",
    apiSecret: process.env.LIVEKIT_API_SECRET ?? "",
    publicUrl: process.env.LIVEKIT_PUBLIC_URL ?? "",
  },
  updates: {
    signingKey: process.env.UPDATE_SIGNING_KEY ?? "",
    releasesDir: process.env.RELEASES_DIR ?? "",
    channel: process.env.UPDATE_CHANNEL ?? "stable",
    /** کلید عمومی امضا — در زمان اجرا سرو می‌شود تا ایمیج آماده نیاز به بیلد مجدد نداشته باشد. */
    publicKey: process.env.UPDATE_PUBKEY ?? process.env.NEXT_PUBLIC_UPDATE_PUBKEY ?? "",
  },
  voiceCapacity: Number(process.env.VOICE_CAPACITY ?? 20),
};
