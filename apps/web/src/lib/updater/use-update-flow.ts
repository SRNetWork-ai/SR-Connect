"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APP_VERSION } from "@/lib/config";
import { beginBoot } from "./crash-guard";
import { runUpdateFlow } from "./run";
import type { FlowState, StepId } from "./types";

const IDLE: FlowState = {
  phase: "running",
  steps: (["connect", "check", "download", "verify", "install", "session"] as StepId[]).map(
    (id) => ({ id, status: "idle" }),
  ),
  canEnter: false,
};

export interface UseUpdateFlowOptions {
  inCall?: boolean;
  /** اجرای خودکار در mount (رفتار واقعی اپ). */
  auto?: boolean;
  theatrical?: boolean;
}

export function useUpdateFlow({ inCall, auto = true, theatrical }: UseUpdateFlowOptions = {}) {
  const [state, setState] = useState<FlowState>(IDLE);
  const [bootAttempts, setBootAttempts] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  const start = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState(IDLE);

    const final = await runUpdateFlow({
      inCall,
      theatrical,
      signal: ctrl.signal,
      onState: setState,
    });
    setState(final);
    return final;
  }, [inCall, theatrical]);

  useEffect(() => {
    if (!auto || startedRef.current) return;
    startedRef.current = true;

    // ثبت بوت برای نگهبان کرش؛ باید قبل از تصمیم‌گیری انجام شود.
    setBootAttempts(beginBoot());
    void start();

    return () => abortRef.current?.abort();
  }, [auto, start]);

  return {
    ...state,
    bootAttempts,
    currentVersion: APP_VERSION,
    retry: start,
  };
}
