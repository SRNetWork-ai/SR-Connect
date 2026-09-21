"use client";

import { create } from "zustand";
import type {
  Attachment,
  Category,
  Channel,
  ChatMessage,
  PresenceStatus,
  PublicUser,
  Reaction,
  ReadState,
  VoiceParticipant,
} from "@sr/protocol";
import { api } from "@/lib/api";
import { RealtimeSocket, type SocketStatus } from "@/lib/realtime/socket";

export interface Member extends PublicUser {
  lastSeenAt?: string | null;
}

export interface Toast {
  id: string;
  kind: "info" | "success" | "warning" | "error";
  text: string;
}

interface Bootstrap {
  user: PublicUser & { permissions: number };
  categories: Category[];
  channels: Channel[];
  members: Member[];
  readState: ReadState[];
  stats: { members: number; online: number; voiceCapacity: number; uptimeSeconds: number };
  features: { voice: boolean; registration: boolean; requireInvite: boolean; uploads: boolean };
}

interface TypingEntry {
  displayName: string;
  expiresAt: number;
}

export interface Unread {
  unread: number;
  mentions: number;
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
  unread: Record<string, Unread>;
  replyTarget: ChatMessage | null;
  editingId: string | null;
  toasts: Toast[];
  versionHint: { latest: string; mandatory: boolean; minClient: string } | null;
  socket: RealtimeSocket | null;

  bootstrap(): Promise<void>;
  teardown(): void;
  setActiveChannel(id: string): void;
  loadHistory(channelId: string, opts?: { older?: boolean }): Promise<void>;
  sendMessage(channelId: string, content: string, files?: File[]): Promise<void>;
  editMessage(channelId: string, messageId: string, content: string): Promise<void>;
  deleteMessage(channelId: string, messageId: string): Promise<void>;
  toggleReaction(channelId: string, messageId: string, emoji: string): Promise<void>;
  setReplyTarget(message: ChatMessage | null): void;
  setEditing(messageId: string | null): void;
  markRead(channelId: string): void;
  updateProfile(patch: {
    displayName?: string;
    bio?: string;
    avatarColor?: string;
    avatar?: File | null;
  }): Promise<void>;
  sendTyping(channelId: string): void;
  refreshChannels(): Promise<void>;
  setPresence(status: PresenceStatus): void;
  publishVoiceState(state: {
    channelId: string | null;
    muted: boolean;
    deafened: boolean;
    streaming?: boolean;
  }): void;
  pushToast(text: string, kind?: Toast["kind"]): void;
  dismissToast(id: string): void;
  dismissVersionHint(): void;
}

const typingCooldown = new Map<string, number>();

/** جای‌گذاری یک پیام در لیست کانال، بدون تغییر ترتیب. */
function replaceIn(list: ChatMessage[], message: ChatMessage): ChatMessage[] {
  let found = false;
  const next = list.map((m) => {
    if (m.id !== message.id) return m;
    found = true;
    return { ...m, ...message };
  });
  return found ? next : [...next, message];
}

function patchMessage(
  messages: Record<string, ChatMessage[]>,
  channelId: string,
  messageId: string,
  patch: Partial<ChatMessage>,
): Record<string, ChatMessage[]> {
  const list = messages[channelId];
  if (!list) return messages;
  return {
    ...messages,
    [channelId]: list.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
  };
}

export const useApp = create<AppState>()((set, get) => ({
  ready: false,
  error: null,
  socketStatus: "idle",
  me: null,
  categories: [],
  channels: [],
  members: [],
  stats: null,
  features: { voice: false, registration: true, requireInvite: false, uploads: true },
  activeChannelId: null,
  messages: {},
  hasMore: {},
  loadingHistory: {},
  presence: {},
  typing: {},
  voice: {},
  unread: {},
  replyTarget: null,
  editingId: null,
  toasts: [],
  versionHint: null,
  socket: null,

  async bootstrap() {
    if (get().socket) return;
    try {
      const data = await api.get<Bootstrap>("/api/bootstrap");
      const firstText = data.channels.find((c) => c.type === "text") ?? data.channels[0];
      const activeChannelId = get().activeChannelId ?? firstText?.id ?? null;
      set({
        ready: true,
        error: null,
        me: data.user,
        categories: data.categories,
        channels: data.channels,
        members: data.members,
        stats: data.stats,
        features: data.features,
        activeChannelId,
        unread: Object.fromEntries(
          (data.readState ?? []).map((r) => [
            r.channelId,
            { unread: r.channelId === activeChannelId ? 0 : r.unread, mentions: r.mentions },
          ]),
        ),
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
                const channelId = msg.message.channelId;
                const list = state.messages[channelId] ?? [];
                if (list.some((m) => m.id === msg.message.id)) break;
                const mine = msg.message.author.id === state.me?.id;
                const focused =
                  channelId === state.activeChannelId &&
                  typeof document !== "undefined" &&
                  document.visibilityState === "visible";
                const prev = state.unread[channelId] ?? { unread: 0, mentions: 0 };
                const mentioned = !!state.me && msg.message.content.includes(`<@${state.me.id}>`);
                set({
                  messages: { ...state.messages, [channelId]: [...list, msg.message].slice(-500) },
                  unread:
                    mine || focused
                      ? state.unread
                      : {
                          ...state.unread,
                          [channelId]: {
                            unread: prev.unread + 1,
                            mentions: prev.mentions + (mentioned ? 1 : 0),
                          },
                        },
                });
                break;
              }
              case "message_update": {
                const list = state.messages[msg.message.channelId];
                if (!list) break;
                set({
                  messages: {
                    ...state.messages,
                    [msg.message.channelId]: replaceIn(list, msg.message),
                  },
                });
                break;
              }
              case "reaction_update": {
                set({
                  messages: patchMessage(state.messages, msg.channelId, msg.messageId, {
                    reactions: msg.reactions,
                  }),
                });
                break;
              }
              case "read_state": {
                set({
                  unread: {
                    ...state.unread,
                    [msg.channelId]: { unread: msg.unread, mentions: msg.mentions },
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
                else get().pushToast(msg.message, "error");
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
    set({ activeChannelId: id, replyTarget: null, editingId: null });
    if (!get().messages[id]) void get().loadHistory(id);
    get().markRead(id);
  },

  markRead(channelId) {
    const current = get().unread[channelId];
    if (current && current.unread === 0 && current.mentions === 0) return;
    set((s) => ({ unread: { ...s.unread, [channelId]: { unread: 0, mentions: 0 } } }));
    const last = (get().messages[channelId] ?? []).at(-1);
    get().socket?.send({ t: "ack_read", channelId, messageId: last?.id ?? "" });
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

  async sendMessage(channelId, content, files) {
    const trimmed = content.trim();
    const hasFiles = Boolean(files?.length);
    if (!trimmed && !hasFiles) return;

    const replyTarget = get().replyTarget;
    const optimisticId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const me = get().me;
    if (me) {
      const optimistic: ChatMessage = {
        id: optimisticId,
        channelId,
        content: trimmed,
        createdAt: new Date().toISOString(),
        editedAt: null,
        replyTo: replyTarget?.id ?? null,
        replyPreview: replyTarget
          ? {
              id: replyTarget.id,
              authorName: replyTarget.author.displayName,
              authorColor: replyTarget.author.avatarColor,
              excerpt: replyTarget.content.slice(0, 140),
              deleted: false,
            }
          : null,
        system: false,
        pending: true,
        attachments: [],
        reactions: [],
        author: {
          id: me.id,
          username: me.username,
          displayName: me.displayName,
          avatarColor: me.avatarColor,
          avatarUrl: me.avatarUrl,
        },
      };
      set((s) => ({
        messages: { ...s.messages, [channelId]: [...(s.messages[channelId] ?? []), optimistic] },
        replyTarget: null,
      }));
    }

    try {
      let attachmentIds: string[] | undefined;
      if (hasFiles) {
        const form = new FormData();
        for (const file of files!) form.append("files", file);
        const up = await api.upload<{ attachments: Attachment[] }>("/api/uploads", form);
        attachmentIds = up.attachments.map((a) => a.id);
      }
      const res = await api.post<{ message: ChatMessage }>(`/api/channels/${channelId}/messages`, {
        content: trimmed,
        replyTo: replyTarget?.id ?? null,
        attachmentIds,
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
        messages: patchMessage(s.messages, channelId, optimisticId, {
          pending: false,
          failed: true,
        }),
      }));
      get().pushToast((err as Error).message, "error");
    }
  },

  async editMessage(channelId, messageId, content) {
    const trimmed = content.trim();
    if (!trimmed) return;
    const before = (get().messages[channelId] ?? []).find((m) => m.id === messageId);
    set((s) => ({
      messages: patchMessage(s.messages, channelId, messageId, {
        content: trimmed,
        editedAt: new Date().toISOString(),
      }),
      editingId: null,
    }));
    try {
      const res = await api.patch<{ message: ChatMessage }>(
        `/api/channels/${channelId}/messages/${messageId}`,
        { content: trimmed },
      );
      set((s) => ({
        messages: patchMessage(s.messages, channelId, messageId, res.message),
      }));
    } catch (err) {
      if (before) {
        set((s) => ({ messages: patchMessage(s.messages, channelId, messageId, before) }));
      }
      get().pushToast((err as Error).message, "error");
    }
  },

  async deleteMessage(channelId, messageId) {
    const snapshot = get().messages[channelId] ?? [];
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: (s.messages[channelId] ?? []).filter((m) => m.id !== messageId),
      },
    }));
    try {
      await api.del(`/api/channels/${channelId}/messages/${messageId}`);
      get().pushToast("پیام حذف شد", "success");
    } catch (err) {
      set((s) => ({ messages: { ...s.messages, [channelId]: snapshot } }));
      get().pushToast((err as Error).message, "error");
    }
  },

  async toggleReaction(channelId, messageId, emoji) {
    const list = get().messages[channelId] ?? [];
    const message = list.find((m) => m.id === messageId);
    if (!message) return;
    const current = message.reactions ?? [];
    const existing = current.find((r) => r.emoji === emoji);
    const mine = existing?.me ?? false;

    // به‌روزرسانی خوش‌بینانه تا کلیک حس فوری بدهد.
    const optimistic: Reaction[] = mine
      ? current
          .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, me: false } : r))
          .filter((r) => r.count > 0)
      : existing
        ? current.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, me: true } : r))
        : [...current, { emoji, count: 1, me: true }];
    set((s) => ({
      messages: patchMessage(s.messages, channelId, messageId, { reactions: optimistic }),
    }));

    try {
      const path = `/api/channels/${channelId}/messages/${messageId}/reactions`;
      const res = mine
        ? await api.del<{ reactions: Reaction[] }>(`${path}?emoji=${encodeURIComponent(emoji)}`)
        : await api.post<{ reactions: Reaction[] }>(path, { emoji });
      set((s) => ({
        messages: patchMessage(s.messages, channelId, messageId, { reactions: res.reactions }),
      }));
    } catch (err) {
      set((s) => ({
        messages: patchMessage(s.messages, channelId, messageId, { reactions: current }),
      }));
      get().pushToast((err as Error).message, "error");
    }
  },

  setReplyTarget(message) {
    set({ replyTarget: message, editingId: null });
  },

  setEditing(messageId) {
    set({ editingId: messageId, replyTarget: null });
  },

  async updateProfile(patch) {
    try {
      let avatarAttachmentId: string | undefined;
      if (patch.avatar) {
        const form = new FormData();
        form.append("avatar", patch.avatar);
        const up = await api.upload<{ attachment: Attachment }>("/api/uploads?kind=avatar", form);
        avatarAttachmentId = up.attachment.id;
      }
      const res = await api.patch<{ user: PublicUser & { permissions: number } }>("/api/users/me", {
        displayName: patch.displayName,
        bio: patch.bio,
        avatarColor: patch.avatarColor,
        avatarAttachmentId,
      });
      set((s) => ({
        me: res.user,
        members: s.members.map((m) => (m.id === res.user.id ? { ...m, ...res.user } : m)),
      }));
      get().pushToast("پروفایل ذخیره شد", "success");
    } catch (err) {
      get().pushToast((err as Error).message, "error");
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

  pushToast(text, kind = "info") {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts, { id, text, kind }].slice(-4) }));
    setTimeout(() => get().dismissToast(id), 4_500);
  },

  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  dismissVersionHint() {
    set({ versionHint: null });
  },
}));
