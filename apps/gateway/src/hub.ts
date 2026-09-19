import type { WebSocket } from "ws";
import type { ChatMessage, PresenceStatus, ServerMessage, VoiceParticipant } from "@sr/protocol";
import { CLOSE_CODES, LIMITS } from "@sr/protocol";
import type { GatewayUser } from "./auth.js";
import { markPresence } from "./auth.js";

export interface Conn {
  id: string;
  ws: WebSocket;
  user: GatewayUser;
  clientVersion: string;
  channels: Set<string>;
  voiceChannelId: string | null;
  voice: { muted: boolean; deafened: boolean; streaming: boolean };
  status: PresenceStatus;
  lastSeen: number;
  joinedAt: string;
  budget: { messages: number; typing: number; windowStart: number };
}

/** رجیستری همه‌ی سوکت‌های زنده + وضعیت ویس و تایپینگ. */
export class Hub {
  private conns = new Map<string, Conn>();
  private byUser = new Map<string, Set<string>>();
  private typing = new Map<string, Map<string, number>>();

  get size() {
    return this.conns.size;
  }

  get onlineUsers() {
    return this.byUser.size;
  }

  add(conn: Conn) {
    let set = this.byUser.get(conn.user.id);
    if (!set) {
      set = new Set();
      this.byUser.set(conn.user.id, set);
    }
    // اگر کاربر بیش از حد سوکت باز کرده، قدیمی‌ترین را می‌بندیم.
    if (set.size >= LIMITS.socketsPerUser) {
      const oldest = [...set][0];
      const victim = oldest ? this.conns.get(oldest) : undefined;
      victim?.ws.close(CLOSE_CODES.RATE_LIMITED, "too many sessions");
    }
    this.conns.set(conn.id, conn);
    set.add(conn.id);
  }

  remove(connId: string) {
    const conn = this.conns.get(connId);
    if (!conn) return;
    this.conns.delete(connId);
    const set = this.byUser.get(conn.user.id);
    set?.delete(connId);
    const wasLast = !set || set.size === 0;
    if (wasLast) this.byUser.delete(conn.user.id);

    if (conn.voiceChannelId) {
      const channelId = conn.voiceChannelId;
      conn.voiceChannelId = null;
      this.broadcastVoice(channelId);
    }
    if (wasLast) {
      void markPresence(conn.user.id, "offline");
      this.broadcast({ t: "presence_update", userId: conn.user.id, status: "offline" });
    }
  }

  send(conn: Conn, msg: ServerMessage) {
    if (conn.ws.readyState !== 1) return;
    try {
      conn.ws.send(JSON.stringify(msg));
    } catch {
      /* سوکت در حال بسته شدن است */
    }
  }

  broadcast(msg: ServerMessage, skipConnId?: string) {
    for (const conn of this.conns.values()) {
      if (conn.id === skipConnId) continue;
      this.send(conn, msg);
    }
  }

  /** ارسال فقط به کسانی که کانال را subscribe کرده‌اند. */
  broadcastChannel(channelId: string, msg: ServerMessage, skipConnId?: string) {
    for (const conn of this.conns.values()) {
      if (conn.id === skipConnId) continue;
      if (!conn.channels.has(channelId)) continue;
      this.send(conn, msg);
    }
  }

  messageCreate(message: ChatMessage) {
    this.broadcastChannel(message.channelId, { t: "message_create", message });
  }

  messageDelete(channelId: string, messageId: string) {
    this.broadcastChannel(channelId, { t: "message_delete", channelId, messageId });
  }

  setPresence(conn: Conn, status: PresenceStatus) {
    conn.status = status;
    void markPresence(conn.user.id, status);
    this.broadcast({ t: "presence_update", userId: conn.user.id, status });
  }

  /** لیست حضور فعلی، برای تازه‌واردها. */
  presenceSnapshot(): { userId: string; status: PresenceStatus }[] {
    const out = new Map<string, PresenceStatus>();
    for (const conn of this.conns.values()) {
      const prev = out.get(conn.user.id);
      if (!prev || prev === "offline") out.set(conn.user.id, conn.status);
    }
    return [...out].map(([userId, status]) => ({ userId, status }));
  }

  typingStart(conn: Conn, channelId: string) {
    const expiresAt = Date.now() + 6_000;
    let map = this.typing.get(channelId);
    if (!map) {
      map = new Map();
      this.typing.set(channelId, map);
    }
    map.set(conn.user.id, expiresAt);
    this.broadcastChannel(
      channelId,
      {
        t: "typing",
        channelId,
        userId: conn.user.id,
        displayName: conn.user.displayName,
        expiresAt,
      },
      conn.id,
    );
  }

  sweepTyping() {
    const now = Date.now();
    for (const [channelId, map] of this.typing) {
      for (const [userId, expires] of map) if (expires < now) map.delete(userId);
      if (map.size === 0) this.typing.delete(channelId);
    }
  }

  voiceState(
    conn: Conn,
    channelId: string | null,
    muted: boolean,
    deafened: boolean,
    streaming: boolean,
  ) {
    const previous = conn.voiceChannelId;
    conn.voiceChannelId = channelId;
    conn.voice = { muted, deafened, streaming };
    if (channelId && !previous) conn.joinedAt = new Date().toISOString();
    if (previous && previous !== channelId) this.broadcastVoice(previous);
    if (channelId) this.broadcastVoice(channelId);
  }

  voiceParticipants(channelId: string): VoiceParticipant[] {
    const seen = new Map<string, VoiceParticipant>();
    for (const conn of this.conns.values()) {
      if (conn.voiceChannelId !== channelId) continue;
      seen.set(conn.user.id, {
        userId: conn.user.id,
        displayName: conn.user.displayName,
        avatarColor: conn.user.avatarColor,
        muted: conn.voice.muted,
        deafened: conn.voice.deafened,
        streaming: conn.voice.streaming,
        joinedAt: conn.joinedAt,
      });
    }
    return [...seen.values()];
  }

  broadcastVoice(channelId: string) {
    this.broadcast({
      t: "voice_update",
      channelId,
      participants: this.voiceParticipants(channelId),
    });
  }

  voiceUserCount() {
    const ids = new Set<string>();
    for (const conn of this.conns.values()) if (conn.voiceChannelId) ids.add(conn.user.id);
    return ids.size;
  }

  /** سهمیه‌ی ساده‌ی پیام/تایپینگ در هر دقیقه برای هر سوکت. */
  allow(conn: Conn, kind: "messages" | "typing"): boolean {
    const now = Date.now();
    if (now - conn.budget.windowStart > 60_000) {
      conn.budget = { messages: 0, typing: 0, windowStart: now };
    }
    const cap = kind === "messages" ? LIMITS.messagesPerMinute : LIMITS.typingPerMinute;
    if (conn.budget[kind] >= cap) return false;
    conn.budget[kind] += 1;
    return true;
  }

  each(fn: (conn: Conn) => void) {
    for (const conn of this.conns.values()) fn(conn);
  }

  closeAll(code: number, reason: string) {
    for (const conn of this.conns.values()) {
      try {
        conn.ws.close(code, reason);
      } catch {
        /* بسته شده */
      }
    }
  }
}
