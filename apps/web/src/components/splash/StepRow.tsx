"use client";

import {
  Check,
  Download,
  LogIn,
  Minus,
  PackageCheck,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/cn";
import { STEP_LABEL } from "@/lib/updater/run";
import type { StepId, StepState } from "@/lib/updater/types";
import { Progress } from "@/components/ui/Progress";
import { Reveal } from "@/components/ui/Reveal";

const ICON: Record<StepId, ComponentType<{ className?: string }>> = {
  connect: PlugZap,
  check: RefreshCw,
  download: Download,
  verify: ShieldCheck,
  install: PackageCheck,
  session: LogIn,
};

export function StepRow({ step, index }: { step: StepState; index: number }) {
  const Icon = ICON[step.id];
  const { status } = step;

  return (
    <li>
      <Reveal delay={index * 0.05} y={6} duration={0.25} className="flex items-start gap-3 py-1.5">
      {/* نشانگر وضعیت */}
      <span
        className={cn(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border transition-colors",
          status === "done" && "border-success bg-success-soft text-success",
          status === "active" && "border-brand bg-brand-soft text-brand",
          status === "failed" && "border-danger bg-danger-soft text-danger",
          status === "skipped" && "border-stroke text-t5",
          status === "idle" && "border-[#3a3c42] text-t5",
        )}
      >
        {status === "done" && <Check className="size-3.5" strokeWidth={3} />}
        {status === "failed" && <X className="size-3.5" strokeWidth={3} />}
        {status === "skipped" && <Minus className="size-3.5" strokeWidth={3} />}
        {status === "idle" && <span className="size-1.5 rounded-full bg-current" />}
        {status === "active" && (
          <span className="size-3.5 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
        )}
      </span>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Icon
            className={cn(
              "size-3.5 shrink-0",
              status === "idle" || status === "skipped" ? "text-t5" : "text-t3",
            )}
          />
          <span
            className={cn(
              "text-sm",
              status === "done" && "text-t2",
              status === "active" && "font-semibold text-t1",
              status === "failed" && "text-[#ff8a8d]",
              (status === "idle" || status === "skipped") && "text-t5",
            )}
          >
            {STEP_LABEL[step.id]}
          </span>

        </div>

        {step.detail && (
          <p
            className={cn(
              "tnum mt-0.5 text-xs",
              status === "failed" ? "text-[#ff8a8d]" : "text-t4",
            )}
          >
            {step.detail}
          </p>
        )}

        {status === "active" && step.progress !== undefined && (
          <Progress value={step.progress} className="mt-2" label={STEP_LABEL[step.id]} />
        )}
      </div>
      </Reveal>
    </li>
  );
}
