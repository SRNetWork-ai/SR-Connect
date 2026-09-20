"use client";

import { motion } from "framer-motion";
import {
  Headphones,
  HeadphoneOff,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  PhoneOff,
  Signal,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/Tooltip";
import { fa } from "@/lib/fmt";
import { useVoice } from "@/store/use-voice";

/**
 * وضعیت تماس صوتی — روی LiveKit.
 * تا وقتی داخل تماس باشی، آپدیت‌کننده نصب را عقب می‌اندازد.
 */
export function VoiceStatus() {
  const status = useVoice((s) => s.status);
  const channelName = useVoice((s) => s.channelName);
  const muted = useVoice((s) => s.muted);
  const deafened = useVoice((s) => s.deafened);
  const streaming = useVoice((s) => s.streaming);
  const canShare = useVoice((s) => s.canShare);
  const ping = useVoice((s) => s.ping);
  const error = useVoice((s) => s.error);
  const toggleMute = useVoice((s) => s.toggleMute);
  const toggleDeafen = useVoice((s) => s.toggleDeafen);
  const toggleScreenShare = useVoice((s) => s.toggleScreenShare);
  const leave = useVoice((s) => s.leave);

  const connected = status === "connected";
  const quality = ping === null ? 3 : ping < 60 ? 3 : ping < 140 ? 2 : 1;

  return (
    <motion.div
      layout
      className={cn(
        "mx-2 mb-1.5 overflow-hidden rounded-lg bg-deep p-2.5",
        connected && "ring-1 ring-success/25",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="relative grid place-items-center">
          <Signal
            className={cn(
              "size-4",
              connected ? "text-success" : status === "connecting" ? "text-warning" : "text-t5",
            )}
          />
          {connected && (
            <span className="absolute inset-0 animate-pulse-ring rounded-full" aria-hidden />
          )}
        </span>
        <span
          className={cn(
            "truncate text-sm font-bold",
            connected ? "text-success" : status === "error" ? "text-danger" : "text-t4",
          )}
        >
          {connected
            ? channelName
            : status === "connecting"
              ? "در حال اتصال…"
              : status === "error"
                ? "اتصال ناموفق"
                : "متصل نیستی"}
        </span>
        <span className="ms-auto flex items-center gap-1.5">
          {connected && (
            <span className="flex items-end gap-0.5" title={`کیفیت اتصال ${quality}/۳`}>
              {[1, 2, 3].map((b) => (
                <span
                  key={b}
                  className={cn(
                    "w-0.5 rounded-sm",
                    b === 1 ? "h-1.5" : b === 2 ? "h-2.5" : "h-3.5",
                    b <= quality ? "bg-success" : "bg-stroke",
                  )}
                />
              ))}
            </span>
          )}
          <span className="tnum text-2xs whitespace-nowrap text-t4">
            {connected ? `${ping !== null ? `${fa(ping)} م‌ث · ` : ""}اوپوس ۳۲ک` : "—"}
          </span>
        </span>
      </div>

      {status === "error" && error && (
        <p className="mt-1.5 text-2xs leading-relaxed text-[#ff8a8d]">{error}</p>
      )}

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
            !canShare
              ? "اجازه‌ی اشتراک صفحه نداری"
              : streaming
                ? "پایان اشتراک صفحه"
                : "اشتراک صفحه"
          }
          active={streaming}
          disabled={!connected || !canShare}
          onClick={() => void toggleScreenShare()}
        >
          {streaming ? <MonitorOff className="size-4" /> : <MonitorUp className="size-4" />}
        </VoiceButton>

        <VoiceButton label="قطع تماس" danger disabled={!connected} onClick={() => void leave()}>
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
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tooltip label={label}>
      <motion.button
        whileTap={{ scale: 0.92 }}
        disabled={disabled}
        onClick={onClick}
        aria-label={label}
        className={cn(
          "grid h-8 w-full place-items-center rounded-[6px] transition-colors disabled:opacity-40",
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
