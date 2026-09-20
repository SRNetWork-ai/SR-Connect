import type {
  ChatMessage,
  PresenceStatus,
  PublicUser,
  Reaction,
  VoiceParticipant,
} from "./types.js";

/** نسخه‌ی قرارداد realtime. اگر عوض شود کلاینت قدیمی باید آپدیت کند. */
export const API_VERSION = 4;

export type ClientMessage =
  | { t: "hello"; token: string; clientVersion: string; apiVersion: number }
  | { t: "ping"; ts: number }
  | { t: "subscribe"; channelIds: string[] }
  | { t: "typing"; channelId: string }
  | { t: "presence"; status: PresenceStatus }
  /** تأیید خواندن کانال تا شمارنده‌ی خوانده‌نشده صفر شود. */
  | { t: "ack_read"; channelId: string; messageId: string }
  | {
      t: "voice_state";
      channelId: string | null;
      muted: boolean;
      deafened: boolean;
      streaming?: boolean;
    };

export type ServerMessage =
  | { t: "ready"; user: PublicUser; serverTime: number; apiVersion: number; latest: string }
  | { t: "pong"; ts: number }
  | { t: "message_create"; message: ChatMessage }
  | { t: "message_update"; message: ChatMessage }
  | { t: "message_delete"; channelId: string; messageId: string }
  | { t: "reaction_update"; channelId: string; messageId: string; reactions: Reaction[] }
  | { t: "read_state"; channelId: string; unread: number; mentions: number }
  | { t: "typing"; channelId: string; userId: string; displayName: string; expiresAt: number }
  | { t: "presence_update"; userId: string; status: PresenceStatus }
  | { t: "voice_update"; channelId: string; participants: VoiceParticipant[] }
  /** ساختار کانال‌ها عوض شد؛ کلاینت باید bootstrap را تازه کند. */
  | { t: "channels_changed" }
  /** سرور می‌تواند وسط کار خبر نسخه‌ی جدید بدهد؛ بنر درون‌اپ از همین استفاده می‌کند. */
  | { t: "version_hint"; latest: string; mandatory: boolean; minClient: string }
  | { t: "error"; code: ErrorCode; message: string };

export type ErrorCode =
  | "unauthorized"
  | "api_version_mismatch"
  | "client_too_old"
  | "rate_limited"
  | "bad_request"
  | "forbidden";

export const CLOSE_CODES = {
  UNAUTHORIZED: 4001,
  API_MISMATCH: 4002,
  CLIENT_TOO_OLD: 4003,
  RATE_LIMITED: 4008,
  SERVER_SHUTDOWN: 4100,
} as const;

/** محدودیت‌های سبک سمت سرور تا یک کلاینت خراب سرور را زمین نزند. */
export const LIMITS = {
  messageLength: 4000,
  attachmentsPerMessage: 10,
  attachmentBytes: 25 * 1024 * 1024,
  avatarBytes: 4 * 1024 * 1024,
  reactionsPerMessage: 24,
  emojiLength: 24,
  messagesPerMinute: 60,
  typingPerMinute: 30,
  socketsPerUser: 4,
  heartbeatMs: 25_000,
  heartbeatTimeoutMs: 60_000,
} as const;
