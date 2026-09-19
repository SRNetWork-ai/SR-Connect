"use client";

import { API_VERSION, LIMITS, type ClientMessage, type ServerMessage } from "@sr/protocol";
import { APP_VERSION, serverEndpoint } from "@/lib/config";

export type SocketStatus = "idle" | "connecting" | "open" | "reconnecting" | "closed";

interface Options {
  onMessage(msg: ServerMessage): void;
  onStatus(status: SocketStatus, detail?: string): void;
}

function gatewayUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_GATEWAY_URL;
  if (explicit) return explicit;
  const base = serverEndpoint("");
  if (base) return base.replace(/^http/, "ws") + "/ws";
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws`;
}

/**
 * کلاینت وب‌سوکت با اتصال مجدد نمایی + jitter.
 * قطع شدن موقت شبکه نباید کاربر را از اپ بیرون بیندازد.
 */
export class RealtimeSocket {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUs = false;
  private queue: ClientMessage[] = [];
  private channelIds: string[] = [];

  constructor(
    /** هر بار یک بلیت یک‌بارمصرف تازه می‌گیرد؛ کوکی نشست httpOnly است و از JS خوانده نمی‌شود. */
    private getTicket: () => Promise<string>,
    private opts: Options,
  ) {}

  async connect() {
    this.closedByUs = false;
    this.opts.onStatus(this.attempt === 0 ? "connecting" : "reconnecting");

    let ticket: string;
    try {
      ticket = await this.getTicket();
    } catch {
      this.scheduleReconnect();
      return;
    }
    if (this.closedByUs) return;

    let ws: WebSocket;
    try {
      ws = new WebSocket(gatewayUrl());
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this.raw({ t: "hello", token: ticket, clientVersion: APP_VERSION, apiVersion: API_VERSION });
      if (this.channelIds.length) this.raw({ t: "subscribe", channelIds: this.channelIds });
      for (const msg of this.queue.splice(0)) this.raw(msg);
      this.heartbeat = setInterval(
        () => this.raw({ t: "ping", ts: Date.now() }),
        LIMITS.heartbeatMs,
      );
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as ServerMessage;
        if (msg.t === "ready") this.opts.onStatus("open");
        this.opts.onMessage(msg);
      } catch {
        /* پیام خراب */
      }
    };

    ws.onclose = (ev) => {
      this.stopHeartbeat();
      this.ws = null;
      if (this.closedByUs) {
        this.opts.onStatus("closed");
        return;
      }
      // کدهای ۴۰۰۱–۴۰۰۳ یعنی تلاش مجدد بی‌فایده است.
      if (ev.code >= 4001 && ev.code <= 4003) {
        this.opts.onStatus("closed", String(ev.code));
        return;
      }
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      /* onclose خودش می‌آید */
    };
  }

  private scheduleReconnect() {
    this.attempt += 1;
    const base = Math.min(1000 * 2 ** (this.attempt - 1), 20_000);
    this.opts.onStatus("reconnecting");
    this.reconnectTimer = setTimeout(() => void this.connect(), base + Math.random() * 500);
  }

  private stopHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private raw(msg: ClientMessage) {
    this.ws?.send(JSON.stringify(msg));
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.raw(msg);
    else if (this.queue.length < 32) this.queue.push(msg);
  }

  subscribe(channelIds: string[]) {
    this.channelIds = channelIds;
    this.send({ t: "subscribe", channelIds });
  }

  close() {
    this.closedByUs = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close(1000, "bye");
    this.ws = null;
  }
}
