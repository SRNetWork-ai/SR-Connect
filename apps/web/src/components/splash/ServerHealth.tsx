import { Gauge, Radio, Server, Users } from "lucide-react";
import { fa } from "@/lib/fmt";
import type { VersionManifest } from "@/lib/updater/types";

const HEALTH = {
  ok: { label: "سالم", className: "text-success" },
  degraded: { label: "کند", className: "text-warning" },
  down: { label: "قطع", className: "text-danger" },
} as const;

export function ServerHealth({ manifest }: { manifest?: VersionManifest }) {
  if (!manifest) {
    return (
      <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-t5">
        وضعیت سرور هنوز خوانده نشده است
      </div>
    );
  }

  const h = HEALTH[manifest.server.health];
  const { used, total } = manifest.server.voiceSlots;

  return (
    <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-white/5 bg-white/5">
      <Cell icon={<Server className="size-3.5" />} label="سرور" value={manifest.server.region} />
      <Cell
        icon={<Radio className={`size-3.5 ${h.className}`} />}
        label="وضعیت"
        value={h.label}
        valueClassName={h.className}
      />
      <Cell
        icon={<Gauge className="size-3.5" />}
        label="تأخیر"
        value={`${fa(manifest.server.latencyMs)} م‌ث`}
      />
      <Cell
        icon={<Users className="size-3.5" />}
        label="ظرفیت صوت"
        value={`${fa(used)}/${fa(total)}`}
      />
    </div>
  );
}

function Cell({
  icon,
  label,
  value,
  valueClassName = "text-t2",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="bg-[#1b1c1f] px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-t5">
        {icon}
        <span className="text-2xs">{label}</span>
      </div>
      <div className={`tnum mt-0.5 text-xs font-semibold ${valueClassName}`}>{value}</div>
    </div>
  );
}
