"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import { useApp } from "@/store/use-app";
import { useVoice } from "@/store/use-voice";

type CallStatus = "idle" | "ringing" | "connecting" | "connected" | "error";

interface CallPeer {
  id: string;
  displayName: string;
  avatarColor?: string;
  avatarUrl?: string | null;
}

interface TokenResponse {
  token: string;
  url: string;
  room: string;
  call: { id: string; status: string; video: boolean } | null;
  channel: { id: string; name: string };
}

interface CallState {
  status: CallStatus;
  peer: CallPeer | null;
  /** تماس ورودیِ در حال زنگ خوردن که هنوز جواب داده نشده. */
  incoming: { id: string; video: boolean; caller: CallPeer } | null;
  video: boolean;
  muted: boolean;
  /** استریم ویدئوی طرف مقابل برای نمایش در پنجره‌ی تماس. */
  remoteVideo: MediaStream | null;
  localVideo: MediaStream | null;
  ping: number | null;
  error: string | null;

  start(peer: CallPeer, video: boolean): Promise<void>;
  accept(): Promise<void>;
  decline(): Promise<void>;
  hangUp(): Promise<void>;
  toggleMute(): Promise<void>;
  toggleVideo(): Promise<void>;
  setIncoming(incoming: CallState["incoming"]): void;
}

let room: import("livekit-client").Room | null = null;
let noiseProcessor: import("@livekit/krisp-noise-filter").KrispNoiseFilterProcessor | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let attempt = 0;

const CONNECT_TIMEOUT_MS = 15_000;

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** همان نویزگیر هوشمندِ کانال صوتی، روی تماس خصوصی هم اعمال می‌شود. */
async function applyNoiseFilter(): Promise<void> {
  if (!room || !useVoice.getState().noiseCancellation) return;
  const { Track } = await import("livekit-client");
  const microphone = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack;
  if (!microphone) return;
  const { KrispNoiseFilter, isKrispNoiseFilterSupported } =
    await import("@livekit/krisp-noise-filter");
  if (!isKrispNoiseFilterSupported()) return;
  noiseProcessor = KrispNoiseFilter({ quality: "medium", useBVC: true });
  await microphone.setProcessor(noiseProcessor).catch(() => {});
}

function cleanupMedia() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  if (typeof document !== "undefined") {
    document.querySelectorAll("[data-sr-call]").forEach((el) => el.remove());
  }
  if (noiseProcessor) {
    void noiseProcessor.destroy().catch(() => {});
    noiseProcessor = null;
  }
  const old = room;
  room = null;
  if (old) void old.disconnect().catch(() => {});
}

export const useCall = create<CallState>()((set, get) => ({
  status: "idle",
  peer: null,
  incoming: null,
  video: false,
  muted: false,
  remoteVideo: null,
  localVideo: null,
  ping: null,
  error: null,

  setIncoming(incoming) {
    // وقتی خودمان وسط تماسیم، زنگ دوم نباید صفحه را بگیرد.
    if (get().status === "connected" || get().status === "connecting") return;
    set({ incoming });
  },

  async start(peer, video) {
    if (get().status === "connecting" || get().status === "connected") return;
    // تماس خصوصی و کانال صوتی هم‌زمان معنا ندارد؛ اول از کانال بیرون می‌آییم.
    if (useVoice.getState().status !== "idle") await useVoice.getState().leave();

    const current = ++attempt;
    const alive = () => current === attempt;
    set({ status: "connecting", peer, video, error: null, incoming: null, muted: false });

    try {
      const auth = await api.post<TokenResponse>(`/api/dm/${peer.id}/call`, { video });
      if (!alive()) return;

      const { Room, RoomEvent, Track } = await import("livekit-client");
      const r = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
        publishDefaults: { dtx: true, red: true, audioPreset: { maxBitrate: 32_000 } },
      });
      room = r;

      r.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.autoplay = true;
          el.dataset.srCall = "1";
          document.body.append(el);
          return;
        }
        if (track.mediaStream) set({ remoteVideo: track.mediaStream });
      });
      r.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove());
        if (track.kind === Track.Kind.Video) set({ remoteVideo: null });
      });
      r.on(RoomEvent.ParticipantDisconnected, () => {
        useApp.getState().pushToast("طرف مقابل تماس را قطع کرد", "info");
        void get().hangUp();
      });
      r.on(RoomEvent.Disconnected, () => {
        cleanupMedia();
        set({
          status: "idle",
          peer: null,
          remoteVideo: null,
          localVideo: null,
          ping: null,
          video: false,
        });
      });

      await withTimeout(
        r.connect(auth.url, auth.token, { autoSubscribe: true, maxRetries: 1 }),
        CONNECT_TIMEOUT_MS,
        "تماس برقرار نشد — احتمالاً پورت‌های UDP سرور بسته است",
      );
      if (!alive()) {
        void r.disconnect().catch(() => {});
        return;
      }

      await r.localParticipant.setMicrophoneEnabled(true).catch(() => {
        useApp.getState().pushToast("میکروفون باز نشد؛ فقط می‌شنوی", "warning");
      });
      await applyNoiseFilter();
      if (video) {
        await r.localParticipant.setCameraEnabled(true).catch(() => {
          useApp.getState().pushToast("دوربین باز نشد", "warning");
          set({ video: false });
        });
      }

      // تا وقتی طرف مقابل جواب ندهد، حالت «در حال زنگ خوردن» می‌ماند.
      const answered = r.remoteParticipants.size > 0;
      set({ status: answered ? "connected" : "ringing" });
      r.on(RoomEvent.ParticipantConnected, () => set({ status: "connected" }));

      const updatePing = async () => {
        const first = [...r.remoteParticipants.values()][0];
        const pub = first ? [...first.audioTrackPublications.values()][0] : undefined;
        const stats = await pub?.track?.getRTCStatsReport?.().catch(() => null);
        let rtt: number | null = null;
        stats?.forEach((report) => {
          const rec = report as { type?: string; roundTripTime?: number };
          if (rec.type === "remote-inbound-rtp" && typeof rec.roundTripTime === "number") {
            rtt = Math.round(rec.roundTripTime * 1000);
          }
        });
        if (rtt !== null) set({ ping: rtt });
      };
      void updatePing();
      pingTimer = setInterval(() => void updatePing(), 5_000);
    } catch (error) {
      if (!alive()) return;
      cleanupMedia();
      const message = (error as Error).message || "تماس برقرار نشد";
      set({ status: "error", error: message, peer: null });
      useApp.getState().pushToast(message, "error");
    }
  },

  async accept() {
    const incoming = get().incoming;
    if (!incoming) return;
    await get().start(incoming.caller, incoming.video);
  },

  async decline() {
    const incoming = get().incoming;
    set({ incoming: null });
    if (incoming) {
      await api.del(`/api/dm/${incoming.caller.id}/call?declined=1`).catch(() => {});
    }
  },

  async hangUp() {
    attempt++;
    const peer = get().peer;
    cleanupMedia();
    set({
      status: "idle",
      peer: null,
      remoteVideo: null,
      localVideo: null,
      ping: null,
      video: false,
      muted: false,
      error: null,
    });
    if (peer) await api.del(`/api/dm/${peer.id}/call`).catch(() => {});
  },

  async toggleMute() {
    const next = !get().muted;
    set({ muted: next });
    if (room) await room.localParticipant.setMicrophoneEnabled(!next).catch(() => {});
  },

  async toggleVideo() {
    const next = !get().video;
    if (!room) {
      set({ video: next });
      return;
    }
    try {
      await room.localParticipant.setCameraEnabled(next);
      set({ video: next });
    } catch {
      useApp.getState().pushToast("دوربین در دسترس نیست", "error");
    }
  },
}));
