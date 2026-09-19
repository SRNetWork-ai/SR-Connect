import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import type { ChatMessage, ClientMessage, PresenceStatus } from "@sr/protocol";
import { API_VERSION, CLOSE_CODES, LIMITS } from "@sr/protocol";
import { authenticate, markPresence } from "./auth.js";
import { listenEvents, pool, q } from "./db.js";
import { env } from "./env.js";
import { Hub, type Conn } from "./hub.js";
import { compareSemver, currentVersion, refreshVersion } from "./version.js";

const hub = new Hub();
const startedAt = Date.now();

const http = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/health" || url.pathname === "/healthz" || url.pathname === "/gateway-health") {
    let db = false;
    try {
      await q("select 1");
      db = true;
    } catch {
      db = false;
    }
    res.writeHead(db ? 200 : 503, { "content-type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        ok: db,
        service: "gateway",
        apiVersion: API_VERSION,
        sockets: hub.size,
        onlineUsers: hub.onlineUsers,
        voiceUsers: hub.voiceUserCount(),
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      }),
    );
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "not_found" }));
});

const wss = new WebSocketServer({ server: http, path: "/ws", maxPayload: 64 * 1024 });

wss.on("connection", (ws, req) => {
  const connId = randomUUID();
  let conn: Conn | null = null;
  let helloTimer: NodeJS.Timeout | null = setTimeout(() => {
    if (!conn) ws.close(CLOSE_CODES.UNAUTHORIZED, "hello timeout");
  }, 10_000);

  const ip = env.trustProxy
    ? (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
    : req.socket.remoteAddress;

  ws.on("message", async (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(raw)) as ClientMessage;
    } catch {
      ws.close(CLOSE_CODES.RATE_LIMITED, "bad json");
      return;
    }

    // ---- دست‌دادن اولیه -------------------------------------------------
    if (!conn) {
      if (msg.t !== "hello") {
        ws.close(CLOSE_CODES.UNAUTHORIZED, "hello required");
        return;
      }
      if (msg.apiVersion !== API_VERSION) {
        ws.send(
          JSON.stringify({
            t: "error",
            code: "api_version_mismatch",
            message: `نسخه‌ی قرارداد سرور ${API_VERSION} است؛ کلاینت باید آپدیت شود.`,
          }),
        );
        ws.close(CLOSE_CODES.API_MISMATCH, "api version");
        return;
      }
      const version = currentVersion();
      if (compareSemver(msg.clientVersion || "0.0.0", version.minClient) < 0) {
        ws.send(
          JSON.stringify({
            t: "error",
            code: "client_too_old",
            message: `حداقل نسخه‌ی مجاز ${version.minClient} است.`,
          }),
        );
        ws.close(CLOSE_CODES.CLIENT_TOO_OLD, "client too old");
        return;
      }
      const user = await authenticate(msg.token);
      if (!user) {
        ws.send(JSON.stringify({ t: "error", code: "unauthorized", message: "نشست معتبر نیست." }));
        ws.close(CLOSE_CODES.UNAUTHORIZED, "unauthorized");
        return;
      }

      if (helloTimer) {
        clearTimeout(helloTimer);
        helloTimer = null;
      }

      conn = {
        id: connId,
        ws,
        user,
        clientVersion: msg.clientVersion,
        channels: new Set(),
        voiceChannelId: null,
        voice: { muted: false, deafened: false, streaming: false },
        status: "online",
        lastSeen: Date.now(),
        joinedAt: new Date().toISOString(),
        budget: { messages: 0, typing: 0, windowStart: Date.now() },
      };
      hub.add(conn);
      void markPresence(user.id, "online");

      hub.send(conn, {
        t: "ready",
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarColor: user.avatarColor,
          status: "online",
          isAdmin: user.isAdmin,
          roles: user.roles,
        },
        serverTime: Date.now(),
        apiVersion: API_VERSION,
        latest: version.latest,
      });
      for (const p of hub.presenceSnapshot()) {
        hub.send(conn, { t: "presence_update", userId: p.userId, status: p.status });
      }
      hub.broadcast({ t: "presence_update", userId: user.id, status: "online" }, conn.id);
      if (compareSemver(version.latest, msg.clientVersion || "0.0.0") > 0) {
        hub.send(conn, {
          t: "version_hint",
          latest: version.latest,
          mandatory: version.mandatory,
          minClient: version.minClient,
        });
      }
      console.log(`[gateway] ${user.username} وصل شد (v${msg.clientVersion}, ip=${ip ?? "?"})`);
      return;
    }

    const c = conn;
    c.lastSeen = Date.now();

    switch (msg.t) {
      case "ping":
        hub.send(c, { t: "pong", ts: msg.ts });
        break;

      case "subscribe": {
        if (!Array.isArray(msg.channelIds)) break;
        c.channels = new Set(msg.channelIds.slice(0, 200).filter((id) => typeof id === "string"));
        for (const id of c.channels) {
          const participants = hub.voiceParticipants(id);
          if (participants.length) hub.send(c, { t: "voice_update", channelId: id, participants });
        }
        break;
      }

      case "typing":
        if (!hub.allow(c, "typing")) break;
        if (typeof msg.channelId === "string") hub.typingStart(c, msg.channelId);
        break;

      case "presence": {
        const allowed: PresenceStatus[] = ["online", "idle", "dnd", "offline"];
        if (allowed.includes(msg.status)) hub.setPresence(c, msg.status);
        break;
      }

      case "voice_state":
        hub.voiceState(
          c,
          typeof msg.channelId === "string" ? msg.channelId : null,
          Boolean(msg.muted),
          Boolean(msg.deafened),
          Boolean(msg.streaming),
        );
        break;

      default:
        hub.send(c, { t: "error", code: "bad_request", message: "پیام ناشناخته" });
    }
  });

  ws.on("close", () => {
    if (helloTimer) clearTimeout(helloTimer);
    hub.remove(connId);
  });
  ws.on("error", () => hub.remove(connId));
});

// ---- ضربان قلب و پاکسازی --------------------------------------------------
const heartbeat = setInterval(() => {
  const now = Date.now();
  hub.each((conn) => {
    if (now - conn.lastSeen > LIMITS.heartbeatTimeoutMs) {
      conn.ws.close(CLOSE_CODES.RATE_LIMITED, "heartbeat timeout");
      return;
    }
    try {
      conn.ws.ping();
    } catch {
      /* بسته شده */
    }
  });
  hub.sweepTyping();
}, LIMITS.heartbeatMs);

// ---- رویدادهای دیتابیس ----------------------------------------------------
async function loadMessage(messageId: string): Promise<ChatMessage | null> {
  const rows = await q<{
    id: string;
    channel_id: string;
    content: string;
    created_at: Date;
    edited_at: Date | null;
    reply_to: string | null;
    system: boolean;
    author_id: string | null;
    username: string | null;
    display_name: string | null;
    avatar_color: string | null;
  }>(
    `select m.id, m.channel_id, m.content, m.created_at, m.edited_at, m.reply_to, m.system,
            u.id as author_id, u.username, u.display_name, u.avatar_color
       from messages m left join users u on u.id = m.author_id
      where m.id = $1 and m.deleted_at is null`,
    [messageId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    channelId: row.channel_id,
    content: row.content,
    createdAt: row.created_at.toISOString(),
    editedAt: row.edited_at ? row.edited_at.toISOString() : null,
    replyTo: row.reply_to,
    system: row.system,
    author: {
      id: row.author_id ?? "system",
      username: row.username ?? "system",
      displayName: row.display_name ?? "سیستم",
      avatarColor: row.avatar_color ?? "#5865F2",
    },
  };
}

const stopListening = listenEvents((event) => {
  void (async () => {
    switch (event.type) {
      case "message_create": {
        const message = await loadMessage(event.messageId);
        if (message) hub.messageCreate(message);
        break;
      }
      case "message_delete":
        hub.messageDelete(event.channelId, event.messageId);
        break;
      case "channels_changed":
        hub.broadcast({ t: "channels_changed" });
        break;
      case "release_published": {
        const v = await refreshVersion();
        hub.broadcast({ t: "version_hint", ...v });
        break;
      }
    }
  })();
});

const versionPoll = setInterval(() => void refreshVersion(), 60_000);

// ---- بالا آوردن و خاموشی نرم ---------------------------------------------
void refreshVersion().then((v) =>
  console.log(`[gateway] نسخه‌ی جاری: ${v.latest} (حداقل ${v.minClient})`),
);

http.listen(env.port, env.host, () => {
  console.log(
    `[gateway] روی ws://${env.host}:${env.port}/ws گوش می‌دهد — apiVersion ${API_VERSION}`,
  );
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[gateway] ${signal} دریافت شد، خاموشی نرم…`);
  clearInterval(heartbeat);
  clearInterval(versionPoll);
  stopListening();
  hub.closeAll(CLOSE_CODES.SERVER_SHUTDOWN, "server shutdown");
  wss.close();
  http.close();
  await pool.end().catch(() => {});
  setTimeout(() => process.exit(0), 500);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
