"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Loader2,
  MonitorOff,
  MonitorUp,
  PhoneOff,
  RotateCcw,
  Signal,
  Sparkles,
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
  const streaming = useVoice((s) => s.streaming);
  const canShare = useVoice((s) => s.canShare);
  const ping = useVoice((s) => s.ping);
  const error = useVoice((s) => s.error);
  const phase = useVoice((s) => s.phase);
  const noiseFilterActive = useVoice((s) => s.noiseFilterActive);
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
      data-live={connected ? "true" : "false"}
      className={cn(
        "console-3d sheen-top relative mx-2 mb-2 overflow-hidden rounded-xl p-2.5",
        status === "error" && "border-danger/40",
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
          {connected && noiseFilterActive && (
            <Tooltip label="نویزگیر هوشمند فعال است">
              <span className="grid size-5 place-items-center rounded-full bg-success-soft text-success">
                <Sparkles className="size-3" />
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
          ) : connected ? (
            /* تنها عددی که واقعاً به کار کاربر می‌آید: تأخیر. رنگش کیفیت را می‌گوید. */
            <span
              className={cn(
                "tnum well-3d rounded-pill px-2 py-0.5 text-2xs whitespace-nowrap font-bold",
                quality === 3 ? "text-success" : quality === 2 ? "text-warning" : "text-danger",
              )}
            >
              {ping !== null ? `${fa(ping)} م‌ث` : "سنجش…"}
            </span>
          ) : null}
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

      {/* میکروفون و هدفون عمداً اینجا نیستند: همین پایین در پنل کاربر همیشه
          در دسترس‌اند و داشتنشان در دو جا، هم تکراری بود و هم مستطیل را
          پرِ دکمه‌های ریز می‌کرد. اینجا فقط کارهای مخصوص همین تماس می‌ماند. */}
      <div className="mt-2.5 grid grid-cols-2 gap-2">
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
          <span className="text-2xs font-bold">{streaming ? "پایان پخش" : "پخش صفحه"}</span>
        </VoiceButton>

        <VoiceButton
          label={connecting ? "لغو اتصال" : "قطع تماس"}
          danger
          disabled={!connected && !connecting}
          onClick={() => (connecting ? cancel() : void leave())}
        >
          <PhoneOff className="size-4" />
          <span className="text-2xs font-bold">{connecting ? "لغو" : "قطع تماس"}</span>
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
  // رنگ فقط وقتی معنی دارد که دکمه قابل زدن باشد؛ دکمه‌ی قرمزِ خاموش گیج‌کننده است.
  const tone = disabled
    ? undefined
    : active && danger
      ? "danger"
      : active
        ? "success"
        : danger
          ? "danger"
          : undefined;

  return (
    <Tooltip label={label}>
      {/* transform را به CSS می‌سپاریم تا با فشردگی سه‌بعدی دکمه تداخل نکند */}
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        data-tone={tone}
        data-no-press
        className={cn(
          "btn-3d flex h-9 w-full items-center justify-center gap-1.5 rounded-[8px] disabled:opacity-40",
          live && "glow-active",
          !tone && "text-t2",
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}
