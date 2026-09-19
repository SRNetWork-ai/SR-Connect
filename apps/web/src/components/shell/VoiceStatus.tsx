"use client";

import { Headphones, HeadphoneOff, Mic, MicOff, PhoneOff, Signal } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
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
  const ping = useVoice((s) => s.ping);
  const error = useVoice((s) => s.error);
  const toggleMute = useVoice((s) => s.toggleMute);
  const toggleDeafen = useVoice((s) => s.toggleDeafen);
  const leave = useVoice((s) => s.leave);

  const connected = status === "connected";

  return (
    <div className="mx-2 mb-1.5 rounded-lg bg-deep p-2.5">
      <div className="flex items-center gap-2">
        <Signal
          className={cn(
            "size-4",
            connected ? "text-success" : status === "connecting" ? "text-warning" : "text-t5",
          )}
        />
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
        <span className="tnum ms-auto text-2xs whitespace-nowrap text-t4">
          {connected ? `${ping !== null ? `${fa(ping)} م‌ث · ` : ""}اوپوس ۳۲ک` : "—"}
        </span>
      </div>

      {status === "error" && error && (
        <p className="mt-1.5 text-2xs leading-relaxed text-[#ff8a8d]">{error}</p>
      )}

      <div className="mt-2 flex gap-1.5">
        <Button
          variant="neutral"
          size="sm"
          className="flex-1"
          disabled={!connected}
          onClick={() => void toggleMute()}
        >
          {muted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
          {muted ? "بی‌صدا" : "میکروفون"}
        </Button>
        <Button variant="neutral" size="sm" className="flex-1" onClick={() => void toggleDeafen()}>
          {deafened ? <HeadphoneOff className="size-3.5" /> : <Headphones className="size-3.5" />}
          هدست
        </Button>
        {connected && (
          <Button
            variant="ghost"
            size="sm"
            className="w-10 bg-danger-soft text-[#ff8a8d] hover:bg-danger hover:text-white"
            title="قطع تماس"
            onClick={() => void leave()}
          >
            <PhoneOff className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
