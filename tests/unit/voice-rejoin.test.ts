import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * رگرسیون باگ «یک‌بار جوین بدی و بزنی بره، دیگر وصل نمی‌شود».
 *
 * ریشه‌ی باگ: LiveKit رویداد Disconnected اتاق قبلی را با تأخیر می‌داد و هندلر
 * آن اتاق، state اتصال تازه را به idle برمی‌گرداند و تایمر آمار را می‌کشت؛
 * پنل صوتی قفل می‌شد. این تست همان ترتیب زمانی را بازسازی می‌کند.
 */

type Handler = (...args: unknown[]) => void;

const rooms: FakeRoom[] = [];

class FakeRoom {
  handlers = new Map<string, Handler[]>();
  connect = vi.fn(async () => {});
  disconnect = vi.fn(async () => {});
  remoteParticipants = new Map();
  localParticipant = {
    setMicrophoneEnabled: vi.fn(async () => {}),
    getTrackPublication: () => undefined,
    setScreenShareEnabled: vi.fn(async () => {}),
  };

  constructor() {
    rooms.push(this);
  }

  on(event: string, fn: Handler) {
    const list = this.handlers.get(event) ?? [];
    list.push(fn);
    this.handlers.set(event, list);
    return this;
  }

  /** رویدادی که مرورگر واقعی دیر می‌فرستد. */
  emit(event: string) {
    for (const fn of this.handlers.get(event) ?? []) fn();
  }
}

vi.mock("livekit-client", () => ({
  Room: FakeRoom,
  RoomEvent: {
    ActiveSpeakersChanged: "activeSpeakersChanged",
    TrackSubscribed: "trackSubscribed",
    TrackUnsubscribed: "trackUnsubscribed",
    Disconnected: "disconnected",
  },
  Track: {
    Kind: { Audio: "audio", Video: "video" },
    Source: { Microphone: "microphone", ScreenShare: "screen_share" },
  },
}));

vi.mock("@livekit/krisp-noise-filter", () => ({
  isKrispNoiseFilterSupported: () => false,
  KrispNoiseFilter: () => ({
    setEnabled: async () => {},
    destroy: async () => {},
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    post: async () => ({
      token: "t",
      url: "wss://example.invalid",
      room: "r",
      canSpeak: true,
      canShare: true,
      channel: { id: "voice-1", name: "بازی", userLimit: 20 },
    }),
  },
  ApiError: class extends Error {},
}));

vi.mock("@/lib/sounds", () => ({ playSound: () => {} }));

vi.mock("@/store/use-app", () => ({
  useApp: {
    getState: () => ({
      pushToast: () => {},
      publishVoiceState: () => {},
      activeChannelId: null,
    }),
  },
}));

vi.mock("@/store/use-session", () => ({
  useSession: { getState: () => ({ setInCall: () => {} }) },
}));

beforeEach(async () => {
  vi.stubGlobal("document", { querySelectorAll: () => [] });
  vi.stubGlobal("fetch", async () => {
    throw new Error("offline");
  });
  // استور بین تست‌ها زنده می‌ماند، پس هر تست از وضعیت پاک شروع می‌شود.
  const { useVoice } = await import("@/store/use-voice");
  await useVoice.getState().leave();
  rooms.length = 0;
});

describe("ورود دوباره به کانال صوتی", () => {
  it("رویداد دیرهنگام اتاق قبلی، اتصال تازه را قطع نمی‌کند", async () => {
    const { useVoice } = await import("@/store/use-voice");

    await useVoice.getState().join("voice-1");
    expect(useVoice.getState().status).toBe("connected");

    await useVoice.getState().leave();
    expect(useVoice.getState().status).toBe("idle");

    // ورود دوباره — اتاق دوم ساخته می‌شود
    await useVoice.getState().join("voice-1");
    expect(useVoice.getState().status).toBe("connected");
    expect(rooms).toHaveLength(2);

    // و حالا اتاق اول تازه خبر قطع شدنش را می‌دهد
    rooms[0].emit("disconnected");

    // قبل از اصلاح، اینجا status به idle می‌افتاد و کاربر دیگر وصل نمی‌شد
    expect(useVoice.getState().status).toBe("connected");
    expect(useVoice.getState().channelId).toBe("voice-1");
  });

  it("رویداد قطع خودِ اتاق جاری، وضعیت را درست پاک می‌کند", async () => {
    const { useVoice } = await import("@/store/use-voice");

    await useVoice.getState().join("voice-1");
    rooms[rooms.length - 1].emit("disconnected");

    expect(useVoice.getState().status).toBe("idle");
    expect(useVoice.getState().channelId).toBeNull();
  });

  it("اتاق قبلی گوینده‌های فعال را روی اتصال تازه نمی‌نویسد", async () => {
    const { useVoice } = await import("@/store/use-voice");

    await useVoice.getState().join("voice-1");
    const stale = rooms[0];
    await useVoice.getState().leave();
    await useVoice.getState().join("voice-1");

    for (const fn of stale.handlers.get("activeSpeakersChanged") ?? []) {
      fn([{ identity: "ghost" }]);
    }
    expect(useVoice.getState().speaking).toEqual([]);
  });
});
