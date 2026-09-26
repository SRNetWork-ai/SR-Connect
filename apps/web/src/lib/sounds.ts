"use client";

/**
 * صداهای رابط، مثل دیسکورد.
 *
 * چرا سنتز به‌جای فایل: هیچ mp3ای همراه بیلد نمی‌رود، پس نه حجم اضافه دارد،
 * نه درخواست شبکه، نه مشکل CSP برای media خارجی. صداها کوتاه و ملایم‌اند و
 * روی بلندگوی لپ‌تاپ هم شنیده می‌شوند.
 */

export type SoundName =
  | "join"
  | "leave"
  | "mute"
  | "unmute"
  | "deafen"
  | "undeafen"
  | "streamStart"
  | "streamStop"
  | "ring"
  | "callConnected"
  | "callEnded"
  | "error";

const STORAGE_KEY = "sr:sounds";
const VOLUME_KEY = "sr:sound-volume";

export function soundsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) !== "off";
}

export function setSoundsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
}

/** ۰ تا ۱؛ پیش‌فرض نیمه تا ناگهانی بلند نباشد. */
export function soundVolume(): number {
  if (typeof window === "undefined") return 0.5;
  // بدون این بررسی، Number(null) برابر صفر می‌شد و صدا پیش‌فرض خاموش می‌ماند.
  const stored = window.localStorage.getItem(VOLUME_KEY);
  if (stored === null || stored === "") return 0.5;
  const raw = Number(stored);
  return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0.5;
}

export function setSoundVolume(value: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VOLUME_KEY, String(Math.min(1, Math.max(0, value))));
}

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  // مرورگر تا اولین تعامل کاربر کانتکست را معلق نگه می‌دارد.
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

interface Tone {
  /** فرکانس شروع و پایان (هرتز)؛ برابر بودنشان یعنی نت ثابت. */
  from: number;
  to?: number;
  /** ثانیه */
  duration: number;
  /** تأخیر نسبت به شروع افکت (ثانیه) */
  at?: number;
  type?: OscillatorType;
  gain?: number;
}

/**
 * هر افکت چند نت کوتاه است. پاکت صدا نرم بالا می‌آید و نرم خاموش می‌شود
 * تا کلیک و تق‌تق ندهد.
 */
const RECIPES: Record<SoundName, Tone[]> = {
  // ورود: دو نت بالارونده، گرم و کوتاه
  join: [
    { from: 520, to: 660, duration: 0.09 },
    { from: 780, to: 880, duration: 0.13, at: 0.07 },
  ],
  // خروج: آینه‌ی ورود، پایین‌رونده
  leave: [
    { from: 660, to: 520, duration: 0.09 },
    { from: 440, to: 330, duration: 0.15, at: 0.07 },
  ],
  mute: [{ from: 420, to: 300, duration: 0.09, type: "triangle" }],
  unmute: [{ from: 300, to: 480, duration: 0.09, type: "triangle" }],
  deafen: [
    { from: 380, to: 260, duration: 0.1, type: "triangle" },
    { from: 260, to: 180, duration: 0.12, at: 0.07, type: "triangle" },
  ],
  undeafen: [
    { from: 260, to: 400, duration: 0.1, type: "triangle" },
    { from: 400, to: 560, duration: 0.12, at: 0.07, type: "triangle" },
  ],
  // شروع پخش زنده: سه‌نتی روشن
  streamStart: [
    { from: 600, duration: 0.07 },
    { from: 760, duration: 0.07, at: 0.07 },
    { from: 960, duration: 0.14, at: 0.14 },
  ],
  streamStop: [
    { from: 760, duration: 0.07 },
    { from: 520, duration: 0.14, at: 0.07 },
  ],
  // زنگ تماس ورودی: دوتایی تکرارشونده
  ring: [
    { from: 880, duration: 0.18, gain: 0.5 },
    { from: 880, duration: 0.18, at: 0.28, gain: 0.5 },
  ],
  callConnected: [
    { from: 660, duration: 0.08 },
    { from: 990, duration: 0.16, at: 0.08 },
  ],
  callEnded: [
    { from: 520, duration: 0.09 },
    { from: 390, duration: 0.09, at: 0.08 },
    { from: 300, duration: 0.16, at: 0.16 },
  ],
  error: [
    { from: 300, duration: 0.1, type: "square", gain: 0.25 },
    { from: 220, duration: 0.16, at: 0.1, type: "square", gain: 0.25 },
  ],
};

/** پخش یک افکت. اگر صدا خاموش باشد یا مرورگر اجازه ندهد، بی‌سروصدا رد می‌شود. */
export function playSound(name: SoundName): void {
  if (!soundsEnabled()) return;
  const context = audio();
  if (!context) return;

  const master = soundVolume();
  if (master <= 0) return;
  const now = context.currentTime;

  for (const tone of RECIPES[name]) {
    const start = now + (tone.at ?? 0);
    const end = start + tone.duration;

    const osc = context.createOscillator();
    osc.type = tone.type ?? "sine";
    osc.frequency.setValueAtTime(tone.from, start);
    if (tone.to && tone.to !== tone.from) {
      osc.frequency.exponentialRampToValueAtTime(tone.to, end);
    }

    const peak = Math.max(0.0001, (tone.gain ?? 0.35) * master);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain).connect(context.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

let ringTimer: ReturnType<typeof setInterval> | null = null;

/** زنگ تماس ورودی تا وقتی جواب یا رد نشده تکرار می‌شود. */
export function startRinging(): void {
  if (ringTimer) return;
  playSound("ring");
  ringTimer = setInterval(() => playSound("ring"), 2_400);
}

export function stopRinging(): void {
  if (!ringTimer) return;
  clearInterval(ringTimer);
  ringTimer = null;
}
