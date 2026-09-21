"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Headphones,
  HeadphoneOff,
  Loader2,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  PhoneOff,
  RotateCcw,
  Signal,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/Tooltip";
import { fa } from "@/lib/fmt";
import { easeQuick, springSnappy, tap } from "@/lib/motion";
import { useApp } from "@/store/use-app";
import { useVoice } from "@/store/use-voice";

/**
 * وضعیت تماس صوتی — روی LiveKit.
 * تا وقتی داخل تماس باشی، آپدیت‌کننده نصب را عقب می‌اندازد.
 */
export function VoiceStatus() {
  const status = useVoice((s) => s.status);
  const channelName = useVoice((s) => s.channelName);
  const channelId = useVoice((s) => s.channelId);
  const muted = useVoice((s) => s.muted);
  const deafened = useVoice((s) => s.deafened);
  const streaming = useVoice((s) => s.streaming);
  const canShare = useVoice((s) => s.canShare);
  const ping = useVoice((s) => s.ping);
  const error = useVoice((s) => s.error);
  const phase = useVoice((s) => s.phase);
  const toggleMute = useVoice((s) => s.toggleMute);
  const toggleDeafen = useVoice((s) => s.toggleDeafen);
  const toggleScreenShare = useVoice((s) => s.toggleScreenShare);
  const leave = useVoice((s) => s.leave);
  const cancel = useVoice((s) => s.cancel);
  const join = useVoice((s) => s.join);
  const lastChannel = useApp((s) => s.activeChannelId);

  const connected = status === "connected";
  const connecting = status === "connecting";
  const quality = ping === null ? 3 : ping < 60 ? 3 : ping < 140 ? 2 : 1;

  const title = connected
    ? channelName
    : connecting
      ? (phase ?? "در حال اتصال…")
      : status === "error"
        ? "اتصال ناموفق"
        : "متصل نیستی";

  return (
    <motion.div
      layout
      transition={springSnappy}
      className={cn(
        "relative mx-2 mb-1.5 overflow-hidden rounded-lg bg-deep p-2.5",
        connected && "ring-1 ring-success/25",
        status === "error" && "ring-1 ring-danger/30",
      )}
    >
      {/* نوار گرادیانی وقتی در حال اتصال است — نشان می‌دهد کار در جریان است */}
      <AnimatePresence>
        {connecting && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="progress-sheen absolute inset-x-0 top-0 h-[2px]"
            aria-hidden
          />
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2">
        <span className="relative grid place-items-center">
          {connecting ? (
            <Loader2 className="size-4 animate-spin text-warning" />
          ) : (
            <Signal className={cn("size-4", connected ? "text-success" : "text-t5")} />
          )}
          {connected && (
            <span className="absolute inset-0 animate-pulse-ring rounded-full" aria-hidden />
          )}
        </span>

        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={title}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={easeQuick}
            className={cn(
              "truncate text-sm font-bold",
              connected ? "text-success" : status === "error" ? "text-danger" : "text-t4",
            )}
          >
            {title}
          </motion.span>
        </AnimatePresence>

        <span className="ms-auto flex items-center gap-1.5">
          {connected && (
            <Tooltip label={`کیفیت اتصال ${fa(quality)}/۳`}>
              <span className="flex items-end gap-0.5">
                {[1, 2, 3].map((b) => (
                  <motion.span
                    key={b}
                    animate={{ opacity: b <= quality ? 1 : 0.35 }}
                    className={cn(
                      "w-0.5 rounded-sm",
                      b === 1 ? "h-1.5" : b === 2 ? "h-2.5" : "h-3.5",
                      b <= quality ? "bg-success" : "bg-stroke",
                    )}
                  />
                ))}
              </span>
            </Tooltip>
          )}

          {connecting ? (
            <Tooltip label="لغو اتصال">
              <motion.button
                whileTap={tap}
                onClick={() => cancel()}
                aria-label="لغو اتصال"
                className="grid size-6 place-items-center rounded-[5px] text-t4 hover:bg-danger-soft hover:text-danger"
              >
                <X className="size-3.5" />
              </motion.button>
            </Tooltip>
          ) : (
            <span className="tnum text-2xs whitespace-nowrap text-t4">
              {connected ? `${ping !== null ? `${fa(ping)} م‌ث · ` : ""}اوپوس ۳۲ک` : "—"}
            </span>
          )}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {status === "error" && error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={easeQuick}
            className="overflow-hidden"
          >
            <p className="mt-1.5 text-2xs leading-relaxed text-[#ff8a8d]">{error}</p>
            <button
              onClick={() => void join(channelId ?? lastChannel ?? "")}
              disabled={!(channelId ?? lastChannel)}
              className="press mt-1.5 inline-flex items-center gap-1 rounded-[5px] bg-card px-2 py-1 text-2xs font-bold text-t2 hover:bg-hover disabled:opacity-40"
            >
              <RotateCcw className="size-3" />
              تلاش دوباره
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-2 grid grid-cols-4 gap-1.5">
        <VoiceButton
          label={muted ? "روشن کردن میکروفون" : "بی‌صدا کردن"}
          active={muted}
          danger={muted}
          disabled={!connected}
          onClick={() => void toggleMute()}
        >
          {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </VoiceButton>

        <VoiceButton
          label={deafened ? "روشن کردن صدا" : "قطع صدا"}
          active={deafened}
          danger={deafened}
          onClick={() => void toggleDeafen()}
        >
          {deafened ? <HeadphoneOff className="size-4" /> : <Headphones className="size-4" />}
        </VoiceButton>

        <VoiceButton
          label={
            !connected
              ? "برای پخش صفحه اول به کانال صوتی وصل شو"
              : !canShare
                ? "اجازه‌ی اشتراک صفحه نداری"
                : streaming
                  ? "پایان پخش صفحه"
                  : "پخش صفحه (لایو)"
          }
          active={streaming}
          live={streaming}
          onClick={() => void toggleScreenShare()}
        >
          {streaming ? <MonitorOff className="size-4" /> : <MonitorUp className="size-4" />}
        </VoiceButton>

        <VoiceButton
          label={connecting ? "لغو اتصال" : "قطع تماس"}
          danger
          disabled={!connected && !connecting}
          onClick={() => (connecting ? cancel() : void leave())}
        >
          <PhoneOff className="size-4" />
        </VoiceButton>
      </div>
    </motion.div>
  );
}

function VoiceButton({
  children,
  label,
  onClick,
  active,
  danger,
  disabled,
  live,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  /** حالت پخش زنده: هاله‌ی نفس‌کش می‌گیرد تا از دور هم دیده شود. */
  live?: boolean;
}) {
  return (
    <Tooltip label={label}>
      <motion.button
        whileTap={disabled ? undefined : tap}
        whileHover={disabled ? undefined : { y: -1 }}
        transition={springSnappy}
        disabled={disabled}
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          "grid h-8 w-full place-items-center rounded-[6px] transition-colors disabled:opacity-40",
          live && "glow-active",
          active && danger
            ? "bg-danger-soft text-danger"
            : active
              ? "bg-success-soft text-success"
              : danger
                ? "bg-card text-[#ff8a8d] hover:bg-danger hover:text-white"
                : "bg-card text-t2 hover:bg-hover",
        )}
      >
        {children}
      </motion.button>
    </Tooltip>
  );
}
