"use client";

import { useMemo } from "react";
import { Logo } from "@/components/ui/Logo";

/**
 * کد QR تزئینی اما قطعی (از یک PRNG ساده با seed ثابت).
 * در فاز ۲ جای آن یک توکن یک‌بارمصرف واقعی از gateway می‌نشیند.
 */
function pattern(seed: number, size: number): boolean[][] {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const g: boolean[][] = [];
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) row.push(rnd() > 0.45);
    g.push(row);
  }
  // سه مربع تشخیص گوشه
  const marker = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++) {
        const edge = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        g[oy + y][ox + x] = edge || core;
      }
  };
  marker(0, 0);
  marker(size - 7, 0);
  marker(0, size - 7);
  return g;
}

export function QrPanel() {
  const size = 25;
  const grid = useMemo(() => pattern(20250128, size), [size]);

  return (
    <aside className="flex w-[240px] flex-col items-center justify-center gap-4 border-s border-divider ps-8">
      <div className="relative rounded-xl bg-white p-3">
        <svg viewBox={`0 0 ${size} ${size}`} className="size-[150px]" shapeRendering="crispEdges">
          {grid.flatMap((row, y) =>
            row.map((on, x) =>
              on ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#111214" /> : null,
            ),
          )}
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-lg bg-white p-1">
            <Logo size={34} />
          </div>
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-base font-bold text-t1">ورود با کد QR</h2>
        <p className="mt-1 text-sm leading-relaxed text-t4">
          اپ موبایل SR-Connect را باز کن و این کد را اسکن کن تا بدون گذرواژه وارد شوی.
        </p>
      </div>
    </aside>
  );
}
