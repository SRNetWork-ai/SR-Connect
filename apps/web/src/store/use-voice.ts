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
  /** متن مرحله‌ی جاری اتصال؛ برای اینکه کاربر بداند چه خبر است. */
  phase: string | null;

  join(channelId: string): Promise<void>;
  leave(): Promise<void>;
  /** لغو اتصالِ نیمه‌کاره بدون انتظار. */
  cancel(): void;
  toggleMute(): Promise<void>;
  toggleDeafen(): Promise<void>;
  toggleScreenShare(): Promise<void>;
}

// اتاق LiveKit بیرون از state نگه داشته می‌شود؛ یک نمونه در کل اپ.
let room: import("livekit-client").Room | null = null;
let statsTimer: ReturnType<typeof setInterval> | null = null;
/** شمارنده‌ی تلاش اتصال؛ نتیجه‌ی تلاش‌های قدیمی نباید state جدید را خراب کند. */
let joinAttempt = 0;

const TOKEN_TIMEOUT_MS = 8_000;
const WS_TIMEOUT_MS = 8_000;
const PC_TIMEOUT_MS = 10_000;
const CONNECT_TIMEOUT_MS = 15_000;

/** هر انتظار شبکه‌ای سقف زمانی دارد؛ وگرنه UI بی‌خود «هنگ» به نظر می‌رسد. */
function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

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
  phase: null,

  async join(channelId) {
    if (get().channelId === channelId && get().status === "connected") return;
    if (get().status === "connecting") return;
    get().leave();
    const attempt = ++joinAttempt;
    const alive = () => attempt === joinAttempt;
    set({ status: "connecting", channelId, error: null, phase: "گرفتن مجوز از سرور" });

    try {
      const auth = await withTimeout(
        api.post<TokenResponse>("/api/voice/token", { channelId }),
        TOKEN_TIMEOUT_MS,
        "سرور مجوز صدا را نداد",
      );
      if (!alive()) return;
      set({ phase: "بارگذاری موتور صدا" });
      const { Room, RoomEvent, Track } = await import("livekit-client");
      if (!alive()) return;

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

      set({ phase: "برقراری تماس" });
      // بدون تایم‌اوت صریح، LiveKit روی شبکه‌ی پرافت‌وخیز ده‌ها ثانیه تلاش می‌کند
      // و کاربر فکر می‌کند دکمه کار نمی‌کند. سریع شکست می‌خوریم و پیام می‌دهیم.
      await withTimeout(
        r.connect(auth.url, auth.token, {
          autoSubscribe: true,
          maxRetries: 1,
          websocketTimeout: WS_TIMEOUT_MS,
          peerConnectionTimeout: PC_TIMEOUT_MS,
        }),
        CONNECT_TIMEOUT_MS,
        "تماس برقرار نشد — احتمالاً پورت‌های UDP سرور بسته است",
      );
      if (!alive()) {
        void r.disconnect().catch(() => {});
        return;
      }

      set({ phase: "روشن کردن میکروفون" });
      if (auth.canSpeak) {
        // اگر مرورگر اجازه‌ی میکروفون نداد، تماس باید برقرار بماند.
        await r.localParticipant.setMicrophoneEnabled(true).catch(() => {
          useApp.getState().pushToast("میکروفون باز نشد؛ شنونده وارد شدی", "warning");
        });
      }
      if (!alive()) {
        void r.disconnect().catch(() => {});
        return;
      }

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
        phase: null,
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
      if (!alive()) return;
      const message = (err as Error).message || "اتصال صدا برقرار نشد";
      if (room) {
        void room.disconnect().catch(() => {});
        room = null;
      }
      set({ status: "error", error: message, channelId: null, phase: null });
      useApp.getState().pushToast(message, "error");
    }
  },

  /**
   * قطع تماس. عمداً منتظر disconnect نمی‌مانیم: بستن WebRTC می‌تواند
   * چند ثانیه طول بکشد و کاربر باید همان لحظه ببیند که قطع شد.
   */
  async leave() {
    joinAttempt++;
    if (statsTimer) {
      clearInterval(statsTimer);
      statsTimer = null;
    }
    if (typeof document !== "undefined") {
      document.querySelectorAll("[data-sr-voice]").forEach((el) => el.remove());
    }
    const old = room;
    room = null;
    if (old) void old.disconnect().catch(() => {});
    useSession.getState().setInCall(false);
    set({
      status: "idle",
      channelId: null,
      channelName: null,
      speaking: [],
      screens: [],
      streaming: false,
      ping: null,
      phase: null,
      error: null,
    });
    useApp.getState().publishVoiceState({ channelId: null, muted: false, deafened: false });
  },

  cancel() {
    void get().leave();
    useApp.getState().pushToast("اتصال لغو شد", "info");
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
    if (!room || get().status !== "connected") {
      useApp.getState().pushToast("اول به یک کانال صوتی وصل شو، بعد صفحه را پخش کن", "warning");
      return;
    }
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
