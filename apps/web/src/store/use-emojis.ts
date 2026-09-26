"use client";

import { create } from "zustand";
import { api } from "@/lib/api";

export interface ServerEmoji {
  id: string;
  name: string;
  kind: "emoji" | "sticker";
  url: string;
}

interface EmojiState {
  items: ServerEmoji[];
  loaded: boolean;
  /** نگاشت name → url تا رندر پیام هر بار آرایه را نگردد. */
  byName: Record<string, string>;
  load(force?: boolean): Promise<void>;
}

let inFlight: Promise<void> | null = null;

export const useEmojis = create<EmojiState>()((set, get) => ({
  items: [],
  loaded: false,
  byName: {},

  async load(force = false) {
    if (!force && (get().loaded || inFlight)) return inFlight ?? undefined;
    inFlight = api
      .get<{ emojis: ServerEmoji[] }>("/api/emojis")
      .then((data) => {
        set({
          items: data.emojis,
          loaded: true,
          byName: Object.fromEntries(data.emojis.map((item) => [item.name, item.url])),
        });
      })
      // نبودِ ایموجی سفارشی نباید هیچ صفحه‌ای را بشکند.
      .catch(() => set({ loaded: true }))
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  },
}));
