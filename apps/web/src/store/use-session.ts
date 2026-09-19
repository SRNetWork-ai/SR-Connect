"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SessionUser {
  id: string;
  name: string;
  tag: string;
  color: string;
}

interface SessionState {
  user: SessionUser | null;
  serverUrl: string;
  /** وسط تماس صوتی هستیم؟ آپدیت‌کننده به این نگاه می‌کند و نصب را عقب می‌اندازد. */
  inCall: boolean;
  rememberMe: boolean;
  signIn(user: SessionUser, serverUrl: string, rememberMe: boolean): void;
  signOut(): void;
  setInCall(v: boolean): void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      serverUrl: process.env.NEXT_PUBLIC_SERVER_URL ?? "",
      inCall: false,
      rememberMe: true,
      signIn: (user, serverUrl, rememberMe) => set({ user, serverUrl, rememberMe }),
      signOut: () => set({ user: null, inCall: false }),
      setInCall: (inCall) => set({ inCall }),
    }),
    {
      name: "sr.session",
      partialize: (s) => ({
        user: s.rememberMe ? s.user : null,
        serverUrl: s.serverUrl,
        rememberMe: s.rememberMe,
      }),
    },
  ),
);
