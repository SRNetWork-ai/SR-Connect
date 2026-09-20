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
  canShare?: boolean;
  channel: { id: string; name: string; userLimit: number };
}

interface VoiceState {
  status: VoiceStatus;
  channelId: string | null;
  channelName: string | null;
  muted: boolean;
  deafened: boolean;
  canSpeak: boolean;
  canShare: boolean;
  /** آیا خودمان در حال اشتراک صفحه هستیم. */
  streaming: boolean;
  /** استریم‌های دریافتی: شناسه‌ی کاربر به MediaStream. */
  screens: { userId: string; displayName: string; stream: MediaStream }[];
  /** شناسه‌ی افرادی که همین لحظه صدایشان می‌آید (حلقه‌ی سبز دور آواتار). */
  speaking: string[];
  ping: number | null;
  error: string | null;

  join(channelId: string): Promise<void>;
  leave(): Promise<void>;
  toggleMute(): Promise<void>;
  toggleDeafen(): Promise<void>;
  toggleScreenShare(): Promise<void>;
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
  canShare: true,
  streaming: false,
  screens: [],
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
      r.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.autoplay = true;
          el.muted = get().deafened;
          el.dataset.srVoice = "1";
          document.body.append(el);
          return;
        }
        // ویدئوی اشتراک صفحه را به‌جای DOM مستقیم، به state می‌دهیم تا React بچیند.
        if (track.source === Track.Source.ScreenShare && track.mediaStream) {
          set((st) => ({
            screens: [
              ...st.screens.filter((s2) => s2.userId !== participant.identity),
              {
                userId: participant.identity,
                displayName: participant.name || participant.identity,
                stream: track.mediaStream!,
              },
            ],
          }));
        }
      });
      r.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
        track.detach().forEach((el) => el.remove());
        if (track.source === Track.Source.ScreenShare) {
          set((st) => ({ screens: st.screens.filter((s2) => s2.userId !== participant.identity) }));
        }
      });
      r.on(RoomEvent.Disconnected, () => {
        useSession.getState().setInCall(false);
        set({
          status: "idle",
          channelId: null,
          channelName: null,
          speaking: [],
          screens: [],
          streaming: false,
          ping: null,
        });
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
        canShare: auth.canShare ?? auth.canSpeak,
        muted: !auth.canSpeak,
        streaming: false,
        screens: [],
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
    set({
      status: "idle",
      channelId: null,
      channelName: null,
      speaking: [],
      screens: [],
      streaming: false,
      ping: null,
    });
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

  /** اشتراک صفحه با صدای سیستم (اگر مرورگر اجازه دهد). */
  async toggleScreenShare() {
    if (!room) return;
    const next = !get().streaming;
    if (next && !get().canShare) {
      useApp.getState().pushToast("اجازه‌ی اشتراک صفحه در این کانال را نداری", "error");
      return;
    }
    try {
      await room.localParticipant.setScreenShareEnabled(next, {
        audio: true,
        resolution: { width: 1280, height: 720, frameRate: 15 },
      });
      set({ streaming: next });
      const { channelId, muted, deafened } = get();
      useApp.getState().publishVoiceState({ channelId, muted, deafened, streaming: next });
    } catch (err) {
      // کاربر پنجره‌ی انتخاب را بست — خطا نیست.
      const message = (err as Error).message ?? "";
      if (!/Permission denied|NotAllowedError|canceled/i.test(message)) {
        useApp.getState().pushToast("اشتراک صفحه شروع نشد", "error");
      }
      set({ streaming: false });
    }
  },
}));
