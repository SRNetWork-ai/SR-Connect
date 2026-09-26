"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Hash, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { fa } from "@/lib/fmt";
import { useApp } from "@/store/use-app";

interface WelcomePayload {
  title: string;
  description: string;
  buttonLabel: string;
  rules: string[];
  channels: { channelId: string; name: string; description: string }[];
}

const DISMISS_KEY = "sr:welcome-seen";

/**
 * ولکام اسکرین فقط یک‌بار برای هر کاربر روی این دستگاه نشان داده می‌شود.
 * اگر ادمین متن را عوض کند، کلید ذخیره‌شده تغییر می‌کند و دوباره نمایش داده می‌شود.
 */
export function WelcomeGate() {
  const me = useApp((s) => s.me);
  const setActiveChannel = useApp((s) => s.setActiveChannel);
  const [welcome, setWelcome] = useState<WelcomePayload | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!me) return;
    void api
      .get<{ welcome: WelcomePayload | null }>("/api/welcome")
      .then((data) => {
        if (!data.welcome) return;
        const stamp = `${me.id}:${data.welcome.title}:${data.welcome.rules.length}`;
        if (window.localStorage.getItem(DISMISS_KEY) === stamp) return;
        setWelcome(data.welcome);
        setOpen(true);
      })
      .catch(() => {
        /* ولکام اسکرین هیچ‌وقت نباید ورود به اپ را بشکند */
      });
  }, [me]);

  function dismiss() {
    if (welcome && me) {
      window.localStorage.setItem(DISMISS_KEY, `${me.id}:${welcome.title}:${welcome.rules.length}`);
    }
    setOpen(false);
  }

  return (
    <AnimatePresence>
      {open && welcome && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[130] grid place-items-center p-4"
        >
          <button
            aria-label="بستن"
            onClick={dismiss}
            className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-[3px]"
          />
          <motion.section
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="surface scroll-y relative max-h-[86vh] w-full max-w-[460px] rounded-xl p-6"
          >
            <Sparkles className="size-8 text-brand" />
            <h1 className="mt-3 text-xl font-black text-t1">{welcome.title}</h1>
            {welcome.description && (
              <p className="mt-2 text-sm leading-6 text-t3">{welcome.description}</p>
            )}

            {welcome.channels.length > 0 && (
              <div className="mt-5 space-y-2">
                {welcome.channels.map((channel) => (
                  <button
                    key={channel.channelId}
                    onClick={() => {
                      setActiveChannel(channel.channelId);
                      dismiss();
                    }}
                    className="flex w-full items-start gap-3 rounded-md bg-card p-3 text-start hover:bg-hover"
                  >
                    <Hash className="mt-0.5 size-4 shrink-0 text-t4" />
                    <span className="min-w-0">
                      <strong className="block truncate text-sm text-t1">{channel.name}</strong>
                      {channel.description && (
                        <span className="block text-xs text-t4">{channel.description}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {welcome.rules.length > 0 && (
              <div className="mt-5 rounded-md bg-card p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold text-t3">
                  <ShieldCheck className="size-4 text-success" /> قوانین سرور
                </p>
                <ol className="mt-2 space-y-1.5">
                  {welcome.rules.map((rule, index) => (
                    <li key={index} className="flex gap-2 text-sm text-t2">
                      <span className="text-t5">{fa(index + 1)}.</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <Button block className="mt-6" onClick={dismiss}>
              {welcome.buttonLabel}
            </Button>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
