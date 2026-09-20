"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, File as FileIcon, FileText, Music, Play, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Attachment } from "@sr/protocol";
import { bytes } from "@/lib/fmt";
import { cn } from "@/lib/cn";

function isImg(a: Attachment) {
  return a.mime.startsWith("image/");
}
function isVid(a: Attachment) {
  return a.mime.startsWith("video/");
}
function isAud(a: Attachment) {
  return a.mime.startsWith("audio/");
}

/** نسبت ابعاد را نگه می‌دارد تا هنگام لود تصویر، چیدمان نپرد. */
function box(a: Attachment, max = 380) {
  const w = a.width ?? 0;
  const h = a.height ?? 0;
  if (!w || !h) return { width: max, height: Math.round(max * 0.62) };
  const scale = Math.min(1, max / w, 280 / h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

export function AttachmentGrid({ items }: { items: Attachment[] }) {
  const [lightbox, setLightbox] = useState<Attachment | null>(null);
  const images = items.filter(isImg);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const i = images.findIndex((x) => x.id === lightbox.id);
        const next = images[(i + (e.key === "ArrowLeft" ? 1 : -1) + images.length) % images.length];
        if (next) setLightbox(next);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox, images]);

  if (items.length === 0) return null;

  return (
    <>
      <div className={cn("mt-1.5 flex flex-wrap gap-2", items.length > 2 && "max-w-[560px]")}>
        {items.map((a, i) => {
          if (isImg(a)) {
            const b = box(a, items.length > 1 ? 240 : 380);
            return (
              <motion.button
                key={a.id}
                type="button"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 320, damping: 26 }}
                whileHover={{ scale: 1.012 }}
                onClick={() => setLightbox(a)}
                className="group relative overflow-hidden rounded-lg border border-white/6 bg-deep"
                style={{ width: b.width, height: b.height }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.url}
                  alt={a.filename}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <span className="pointer-events-none absolute bottom-1.5 start-2 truncate text-2xs text-white/90 opacity-0 transition-opacity group-hover:opacity-100">
                  {a.filename}
                </span>
              </motion.button>
            );
          }

          if (isVid(a)) {
            return (
              <video
                key={a.id}
                src={a.url}
                controls
                preload="metadata"
                className="max-h-[300px] max-w-[420px] rounded-lg border border-white/6 bg-black"
              />
            );
          }

          if (isAud(a)) {
            return (
              <div
                key={a.id}
                className="surface flex w-[320px] items-center gap-2.5 rounded-lg px-3 py-2"
              >
                <Music className="size-4 shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-t2">{a.filename}</p>
                  <audio src={a.url} controls className="mt-1 h-7 w-full" preload="metadata" />
                </div>
              </div>
            );
          }

          const Icon = a.mime === "application/pdf" ? FileText : FileIcon;
          return (
            <motion.a
              key={a.id}
              href={a.url}
              download={a.filename}
              whileHover={{ y: -1 }}
              className="surface flex w-[300px] items-center gap-2.5 rounded-lg px-3 py-2.5 transition-colors hover:border-brand/40"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-[6px] bg-brand-soft">
                <Icon className="size-4.5 text-brand" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-link">{a.filename}</span>
                <span className="tnum block text-2xs text-t4">{bytes(a.size)}</span>
              </span>
              <Download className="size-4 shrink-0 text-t4" />
            </motion.a>
          );
        })}
      </div>

      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-[120] grid place-items-center bg-black/82 p-6 backdrop-blur-sm"
          >
            <motion.img
              key={lightbox.id}
              layoutId={`att-${lightbox.id}`}
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              src={lightbox.url}
              alt={lightbox.filename}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[84vh] max-w-[92vw] rounded-xl object-contain shadow-float"
            />
            <div className="mt-3 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
              <span className="text-sm text-white/80">{lightbox.filename}</span>
              <a
                href={lightbox.url}
                download={lightbox.filename}
                className="flex items-center gap-1.5 rounded-pill bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
              >
                <Download className="size-3.5" />
                دانلود
              </a>
            </div>
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-5 end-5 grid size-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <X className="size-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** پیش‌نمایش فایل‌های انتخاب‌شده داخل کامپوزر. */
export function PendingFiles({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const made = files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : ""));
    setUrls(made);
    return () => made.forEach((u) => u && URL.revokeObjectURL(u));
  }, [files]);

  if (files.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="flex flex-wrap gap-2 border-b border-divider px-3 pt-3 pb-2.5"
    >
      {files.map((f, i) => (
        <motion.div
          key={`${f.name}-${i}`}
          layout
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="group relative size-[76px] overflow-hidden rounded-lg border border-stroke bg-deep"
        >
          {urls[i] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urls[i]} alt={f.name} className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center p-1 text-center">
              {f.type.startsWith("video/") ? (
                <Play className="size-5 text-t3" />
              ) : (
                <FileIcon className="size-5 text-t3" />
              )}
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-1 py-0.5 text-[9px] text-white/90">
            {f.name}
          </span>
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute top-1 end-1 grid size-5 place-items-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </motion.div>
      ))}
    </motion.div>
  );
}
