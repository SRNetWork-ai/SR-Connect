import { createHmac } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * LiveKit فقط یک JWT با الگوریتم HS256 می‌خواهد.
 * برای اجتناب از یک وابستگی اضافه، خودمان امضا می‌کنیم.
 */
function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export interface VoiceTokenOptions {
  identity: string;
  name: string;
  room: string;
  canPublish: boolean;
  ttlSeconds?: number;
  metadata?: Record<string, unknown>;
}

export function createVoiceToken(opts: VoiceTokenOptions): string {
  const { apiKey, apiSecret } = serverEnv.livekit;
  if (!apiKey || !apiSecret) throw new Error("کلیدهای LiveKit تنظیم نشده‌اند");

  const now = Math.floor(Date.now() / 1000);
  const ttl = opts.ttlSeconds ?? 6 * 3600;

  const payload = {
    iss: apiKey,
    sub: opts.identity,
    nbf: now - 10,
    exp: now + ttl,
    jti: `${opts.identity}-${now}`,
    name: opts.name,
    metadata: opts.metadata ? JSON.stringify(opts.metadata) : undefined,
    video: {
      room: opts.room,
      roomJoin: true,
      canPublish: opts.canPublish,
      canSubscribe: true,
      canPublishData: true,
    },
  };

  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", apiSecret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}
