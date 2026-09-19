"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import { useApp } from "@/store/use-app";
import { useSession } from "@/store/use-session";

type VoiceStatus = "idle" | "connecting" | "connected" | "error";

interface TokenResponse {
  token: string;
  url: string;
  room: string;
  canSpeak: boolean;
  channel: { id: string; name: string; userLimit: number };
}

interface VoiceState {
  status: VoiceStatus;
  channelId: string | null;
  channelName: string | null;
  muted: boolean;
  deafened: boolean;
  canSpeak: boolean;
  /** شناسه‌ی افرادی که همین لحظه صدایشان می‌آید (حلقه‌ی سبز دور آواتار). */
  speaking: string[];
  ping: number | null;
  error: string | null;

  join(channelId: string): Promise<void>;
  leave(): Promise<void>;
  toggleMute(): Promise<void>;
  toggleDeafen(): Promise<void>;
}

// اتاق LiveKit بیرون از state نگه داشته می‌شود؛ یک نمونه در کل اپ.
let room: import("livekit-client").Room | null = null;
let statsTimer: ReturnType<typeof setInterval> | null = null;

export const useVoice = create<VoiceState>()((set, get) => ({
  status: "idle",
  channelId: null,
  channelName: null,
  muted: false,
  deafened: false,
  canSpeak: true,
  speaking: [],
  ping: null,
  error: null,

  async join(channelId) {
    if (get().channelId === channelId && get().status === "connected") return;
    await get().leave();
    set({ status: "connecting", channelId, error: null });

    try {
      const auth = await api.post<TokenResponse>("/api/voice/token", { channelId });
      const { Room, RoomEvent, Track } = await import("livekit-client");

      const r = new Room({
        adaptiveStream: true,
        dynacast: true,
        // روی VPS کوچک، صدای مونو با نرخ پایین کیفیت را حفظ می‌کند و پهنای باند را نصف.
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
        publishDefaults: { dtx: true, red: true, audioPreset: { maxBitrate: 32_000 } },
      });
      room = r;

      r.on(RoomEvent.ActiveSpeakersChanged, (speakers) =>
        set({ speaking: speakers.map((s) => s.identity) }),
      );
      r.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.autoplay = true;
          el.muted = get().deafened;
          el.dataset.srVoice = "1";
          document.body.append(el);
        }
      });
      r.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((el) => el.remove()));
      r.on(RoomEvent.Disconnected, () => {
        useSession.getState().setInCall(false);
        set({ status: "idle", channelId: null, channelName: null, speaking: [], ping: null });
        useApp.getState().publishVoiceState({ channelId: null, muted: false, deafened: false });
      });

      await r.connect(auth.url, auth.token, { autoSubscribe: true });
      if (auth.canSpeak) await r.localParticipant.setMicrophoneEnabled(true);

      useSession.getState().setInCall(true);
      set({
        status: "connected",
        channelId,
        channelName: auth.channel.name,
        canSpeak: auth.canSpeak,
        muted: !auth.canSpeak,
        error: null,
      });

      useApp
        .getState()
        .publishVoiceState({ channelId, muted: !auth.canSpeak, deafened: get().deafened });

      // تأخیر واقعی را از گزارش WebRTC می‌خوانیم، نه عدد ساختگی.
      statsTimer = setInterval(async () => {
        const first = [...r.remoteParticipants.values()][0];
        const pub = first ? [...first.audioTrackPublications.values()][0] : undefined;
        const stats = await pub?.track?.getRTCStatsReport?.().catch(() => null);
        if (!stats) return;
        let rtt: number | null = null;
        stats.forEach((report) => {
          const rec = report as { type?: string; roundTripTime?: number };
          if (rec.type === "remote-inbound-rtp" && typeof rec.roundTripTime === "number") {
            rtt = Math.round(rec.roundTripTime * 1000);
          }
        });
        if (rtt !== null) set({ ping: rtt });
      }, 5_000);
    } catch (err) {
      set({ status: "error", error: (err as Error).message, channelId: null });
    }
  },

  async leave() {
    if (statsTimer) {
      clearInterval(statsTimer);
      statsTimer = null;
    }
    document.querySelectorAll("[data-sr-voice]").forEach((el) => el.remove());
    if (room) {
      await room.disconnect().catch(() => {});
      room = null;
    }
    useSession.getState().setInCall(false);
    set({ status: "idle", channelId: null, channelName: null, speaking: [], ping: null });
    useApp.getState().publishVoiceState({ channelId: null, muted: false, deafened: false });
  },

  async toggleMute() {
    const next = !get().muted;
    set({ muted: next });
    if (room && get().canSpeak) {
      await room.localParticipant.setMicrophoneEnabled(!next).catch(() => {});
    }
    const { channelId, deafened } = get();
    useApp.getState().publishVoiceState({ channelId, muted: next, deafened });
  },

  async toggleDeafen() {
    const next = !get().deafened;
    // بی‌صدا کردن هدفون، میکروفون را هم می‌بندد — مثل دیسکورد.
    set({ deafened: next, muted: next ? true : get().muted });
    document
      .querySelectorAll<HTMLAudioElement>("[data-sr-voice]")
      .forEach((el) => (el.muted = next));
    if (room && get().canSpeak) {
      await room.localParticipant.setMicrophoneEnabled(!get().muted).catch(() => {});
    }
    const { channelId, muted } = get();
    useApp.getState().publishVoiceState({ channelId, muted, deafened: next });
  },
}));
