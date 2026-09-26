"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fa } from "@/lib/fmt";
import { useApp } from "@/store/use-app";
import { useCall } from "@/store/use-call";

/** هر چند ثانیه تماس‌های ورودی چک می‌شود؛ سبک‌تر از باز نگه داشتن یک سوکت جدا. */
const POLL_MS = 4_000;

export function CallOverlay() {
  const me = useApp((s) => s.me);
  const status = useCall((s) => s.status);
  const peer = useCall((s) => s.peer);
  const incoming = useCall((s) => s.incoming);
  const muted = useCall((s) => s.muted);
  const video = useCall((s) => s.video);
  const ping = useCall((s) => s.ping);
  const remoteVideo = useCall((s) => s.remoteVideo);
  const setIncoming = useCall((s) => s.setIncoming);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await api.get<{
          calls: { id: string; video: boolean; caller: NonNullable<typeof peer> }[];
        }>("/api/calls");
        if (cancelled) return;
        const first = data.calls[0];
        setIncoming(first ? { id: first.id, video: first.video, caller: first.caller } : null);
      } catch {
        /* قطعی موقت شبکه نباید توست خطا بسازد */
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [me, setIncoming]);

  useEffect(() => {
    if (videoRef.current && remoteVideo) videoRef.current.srcObject = remoteVideo;
  }, [remoteVideo]);

  const active = status === "ringing" || status === "connecting" || status === "connected";

  return (
    <>
      <AnimatePresence>
        {incoming && !active && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="surface fixed end-4 top-4 z-[140] w-[300px] rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <Avatar
                name={incoming.caller.displayName}
                color={incoming.caller.avatarColor ?? "#5865F2"}
                url={incoming.caller.avatarUrl}
                size="md"
              />
              <div className="min-w-0">
                <strong className="block truncate text-sm text-t1">
                  {incoming.caller.displayName}
                </strong>
                <span className="text-xs text-t4">
                  {incoming.video ? "تماس تصویری ورودی" : "تماس صوتی ورودی"}
                </span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => void useCall.getState().accept()}
                className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-success text-sm font-bold text-white"
              >
                <Phone className="size-4" /> پاسخ
              </button>
              <button
                onClick={() => void useCall.getState().decline()}
                className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-danger text-sm font-bold text-white"
              >
                <PhoneOff className="size-4" /> رد
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {active && peer && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="surface fixed bottom-4 end-4 z-[140] w-[320px] overflow-hidden rounded-xl"
          >
            <div className="relative grid h-[180px] place-items-center bg-deep">
              {remoteVideo ? (
                <video ref={videoRef} autoPlay playsInline className="size-full object-cover" />
              ) : (
                <Avatar
                  name={peer.displayName}
                  color={peer.avatarColor ?? "#5865F2"}
                  url={peer.avatarUrl}
                  size="xl"
                />
              )}
              <span
                className={cn(
                  "absolute start-2 top-2 rounded-pill px-2 py-0.5 text-2xs font-bold",
                  status === "connected"
                    ? "bg-success/20 text-success"
                    : "bg-warning/20 text-warning",
                )}
              >
                {status === "connected"
                  ? ping === null
                    ? "متصل"
                    : `${fa(ping)} میلی‌ثانیه`
                  : status === "ringing"
                    ? "در حال زنگ خوردن…"
                    : "در حال اتصال…"}
              </span>
            </div>

            <div className="flex items-center gap-2 p-3">
              <strong className="min-w-0 flex-1 truncate text-sm text-t1">
                {peer.displayName}
              </strong>
              <button
                onClick={() => void useCall.getState().toggleMute()}
                aria-label={muted ? "روشن کردن میکروفون" : "بی‌صدا"}
                className={cn(
                  "grid size-9 place-items-center rounded-md",
                  muted ? "bg-danger text-white" : "bg-card text-t2 hover:bg-hover",
                )}
              >
                {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              </button>
              <button
                onClick={() => void useCall.getState().toggleVideo()}
                aria-label={video ? "خاموش کردن دوربین" : "روشن کردن دوربین"}
                className={cn(
                  "grid size-9 place-items-center rounded-md",
                  video ? "bg-brand text-white" : "bg-card text-t2 hover:bg-hover",
                )}
              >
                {video ? <Video className="size-4" /> : <VideoOff className="size-4" />}
              </button>
              <button
                onClick={() => void useCall.getState().hangUp()}
                aria-label="قطع تماس"
                className="grid size-9 place-items-center rounded-md bg-danger text-white"
              >
                <PhoneOff className="size-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
