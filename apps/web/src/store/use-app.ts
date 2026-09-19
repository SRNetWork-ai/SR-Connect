"use client";

import { create } from "zustand";
import type {
  Category,
  Channel,
  ChatMessage,
  PresenceStatus,
  PublicUser,
  VoiceParticipant,
} from "@sr/protocol";
import { api } from "@/lib/api";
import { RealtimeSocket, type SocketStatus } from "@/lib/realtime/socket";

export interface Member extends PublicUser {
  lastSeenAt?: string | null;
}

interface Bootstrap {
  user: PublicUser & { permissions: number };
  categories: Category[];
  channels: Channel[];
  members: Member[];
  stats: { members: number; online: number; voiceCapacity: number; uptimeSeconds: number };
  features: { voice: boolean; registration: boolean; requireInvite: boolean };
}

interface TypingEntry {
  displayName: string;
  expiresAt: number;
}

interface AppState {
  ready: boolean;
  error: string | null;
  socketStatus: SocketStatus;
  me: (PublicUser & { permissions: number }) | null;
  categories: Category[];
  channels: Channel[];
  members: Member[];
  stats: Bootstrap["stats"] | null;
  features: Bootstrap["features"];
  activeChannelId: string | null;
  messages: Record<string, ChatMessage[]>;
  hasMore: Record<string, boolean>;
  loadingHistory: Record<string, boolean>;
  presence: Record<string, PresenceStatus>;
  typing: Record<string, Record<string, TypingEntry>>;
  voice: Record<string, VoiceParticipant[]>;
  versionHint: { latest: string; mandatory: boolean; minClient: string } | null;
  socket: RealtimeSocket | null;

  bootstrap(): Promise<void>;
  teardown(): void;
  setActiveChannel(id: string): void;
  loadHistory(channelId: string, opts?: { older?: boolean }): Promise<void>;
  sendMessage(channelId: string, content: string): Promise<void>;
  sendTyping(channelId: string): void;
  refreshChannels(): Promise<void>;
  setPresence(status: PresenceStatus): void;
  publishVoiceState(state: {
    channelId: string | null;
    muted: boolean;
    deafened: boolean;
    streaming?: boolean;
  }): void;
  dismissVersionHint(): void;
}

const typingCooldown = new Map<string, number>();

export const useApp = create<AppState>()((set, get) => ({
  ready: false,
  error: null,
  socketStatus: "idle",
  me: null,
  categories: [],
  channels: [],
  members: [],
  stats: null,
  features: { voice: false, registration: true, requireInvite: false },
  activeChannelId: null,
  messages: {},
  hasMore: {},
  loadingHistory: {},
  presence: {},
  typing: {},
  voice: {},
  versionHint: null,
  socket: null,

  async bootstrap() {
    if (get().socket) return;
    try {
      const data = await api.get<Bootstrap>("/api/bootstrap");
      const firstText = data.channels.find((c) => c.type === "text") ?? data.channels[0];
      set({
        ready: true,
        error: null,
        me: data.user,
        categories: data.categories,
        channels: data.channels,
        members: data.members,
        stats: data.stats,
        features: data.features,
        activeChannelId: get().activeChannelId ?? firstText?.id ?? null,
        presence: Object.fromEntries(data.members.map((m) => [m.id, m.status])),
      });

      const socket = new RealtimeSocket(
        async () => (await api.post<{ ticket: string }>("/api/realtime/ticket")).ticket,
        {
          onStatus: (socketStatus) => set({ socketStatus }),
          onMessage: (msg) => {
            const state = get();
            switch (msg.t) {
              case "ready":
                socket.subscribe(state.channels.map((c) => c.id));
                break;
              case "message_create": {
                const list = state.messages[msg.message.channelId] ?? [];
                if (list.some((m) => m.id === msg.message.id)) break;
                set({
                  messages: {
                    ...state.messages,
                    [msg.message.channelId]: [...list, msg.message].slice(-500),
                  },
                });
                break;
              }
              case "message_delete": {
                const list = state.messages[msg.channelId];
                if (!list) break;
                set({
                  messages: {
                    ...state.messages,
                    [msg.channelId]: list.filter((m) => m.id !== msg.messageId),
                  },
                });
                break;
              }
              case "typing": {
                const forChannel = { ...(state.typing[msg.channelId] ?? {}) };
                forChannel[msg.userId] = { displayName: msg.displayName, expiresAt: msg.expiresAt };
                set({ typing: { ...state.typing, [msg.channelId]: forChannel } });
                break;
              }
              case "presence_update":
                set({ presence: { ...state.presence, [msg.userId]: msg.status } });
                break;
              case "voice_update":
                set({ voice: { ...state.voice, [msg.channelId]: msg.participants } });
                break;
              case "channels_changed":
                void get().refreshChannels();
                break;
              case "version_hint":
                set({
                  versionHint: {
                    latest: msg.latest,
                    mandatory: msg.mandatory,
                    minClient: msg.minClient,
                  },
                });
                break;
              case "error":
                if (msg.code === "unauthorized") set({ error: msg.message });
                break;
              default:
                break;
            }
          },
        },
      );
      set({ socket });
      void socket.connect();

      const active = get().activeChannelId;
      if (active) void get().loadHistory(active);
    } catch (err) {
      set({ ready: false, error: (err as Error).message });
    }
  },

  teardown() {
    get().socket?.close();
    set({ socket: null, socketStatus: "closed", ready: false });
  },

  setActiveChannel(id) {
    set({ activeChannelId: id });
    if (!get().messages[id]) void get().loadHistory(id);
  },

  async loadHistory(channelId, opts) {
    if (get().loadingHistory[channelId]) return;
    set({ loadingHistory: { ...get().loadingHistory, [channelId]: true } });
    try {
      const existing = get().messages[channelId] ?? [];
      const before =
        opts?.older && existing[0] ? `?before=${encodeURIComponent(existing[0].createdAt)}` : "";
      const data = await api.get<{ messages: ChatMessage[]; hasMore: boolean }>(
        `/api/channels/${channelId}/messages${before}`,
      );
      set((s) => ({
        messages: {
          ...s.messages,
          [channelId]: opts?.older ? [...data.messages, ...existing] : data.messages,
        },
        hasMore: { ...s.hasMore, [channelId]: data.hasMore },
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    } finally {
      set((s) => ({ loadingHistory: { ...s.loadingHistory, [channelId]: false } }));
    }
  },

  async sendMessage(channelId, content) {
    const trimmed = content.trim();
    if (!trimmed) return;

    // پیام را همان لحظه نشان می‌دهیم؛ اگر سرور خطا داد برمی‌گردانیم.
    const optimisticId = `tmp-${Date.now()}`;
    const me = get().me;
    if (me) {
      const optimistic: ChatMessage = {
        id: optimisticId,
        channelId,
        content: trimmed,
        createdAt: new Date().toISOString(),
        editedAt: null,
        replyTo: null,
        system: false,
        author: {
          id: me.id,
          username: me.username,
          displayName: me.displayName,
          avatarColor: me.avatarColor,
        },
      };
      set((s) => ({
        messages: { ...s.messages, [channelId]: [...(s.messages[channelId] ?? []), optimistic] },
      }));
    }

    try {
      const res = await api.post<{ message: ChatMessage }>(`/api/channels/${channelId}/messages`, {
        content: trimmed,
      });
      set((s) => {
        const list = s.messages[channelId] ?? [];
        const withoutTmp = list.filter((m) => m.id !== optimisticId);
        const exists = withoutTmp.some((m) => m.id === res.message.id);
        return {
          messages: {
            ...s.messages,
            [channelId]: exists ? withoutTmp : [...withoutTmp, res.message],
          },
        };
      });
    } catch (err) {
      set((s) => ({
        error: (err as Error).message,
        messages: {
          ...s.messages,
          [channelId]: (s.messages[channelId] ?? []).filter((m) => m.id !== optimisticId),
        },
      }));
    }
  },

  sendTyping(channelId) {
    const now = Date.now();
    if (now - (typingCooldown.get(channelId) ?? 0) < 3_000) return;
    typingCooldown.set(channelId, now);
    get().socket?.send({ t: "typing", channelId });
  },

  async refreshChannels() {
    try {
      const data = await api.get<Bootstrap>("/api/bootstrap");
      set({
        categories: data.categories,
        channels: data.channels,
        members: data.members,
        stats: data.stats,
        features: data.features,
      });
      get().socket?.subscribe(data.channels.map((c) => c.id));
    } catch {
      /* شبکه قطع است؛ دفعه‌ی بعد */
    }
  },

  setPresence(status) {
    get().socket?.send({ t: "presence", status });
    const me = get().me;
    if (me) set((s) => ({ presence: { ...s.presence, [me.id]: status } }));
  },

  publishVoiceState({ channelId, muted, deafened, streaming }) {
    get().socket?.send({
      t: "voice_state",
      channelId,
      muted,
      deafened,
      streaming: streaming ?? false,
    });
  },

  dismissVersionHint() {
    set({ versionHint: null });
  },
}));
