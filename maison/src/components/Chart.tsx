"use client";

import { useId, useState } from "react";
import { DOWN, UP } from "@/lib/format";

/** Price chart with a draggable crosshair. */
export function Chart({ values, labels, height = 160 }: { values: number[]; labels?: string[]; height?: number }) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [hover, setHover] = useState<number | null>(null);
  if (values.length < 2) {
    return (
      <div className="grid place-items-center rounded-3xl bg-surface text-sm text-muted" style={{ height }}>
        Not enough data yet
      </div>
    );
  }
  const w = 300;
  const h = 100;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.12 || 1;
  const y = (v: number) => h - ((v - (min - pad)) / (max - min + pad * 2)) * h;
  const x = (i: number) => (i / (values.length - 1)) * w;
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const up = values[values.length - 1] >= values[0];
  const color = up ? UP : DOWN;
  const i = hover ?? values.length - 1;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const k = Math.round(((e.clientX - rect.left) / rect.width) * (values.length - 1));
    setHover(Math.max(0, Math.min(values.length - 1, k)));
  };

  return (
    <div className="rounded-3xl bg-surface p-4">
      <div className="flex items-baseline justify-between font-mono text-xs text-muted">
        <span>{labels?.[i] ?? ""}</span>
        <span className="font-bold text-ivory tabular-nums">{values[i].toFixed(1)}</span>
      </div>
      <div
        className="relative mt-2 touch-none select-none"
        style={{ height }}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        onPointerUp={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.3" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={`url(#${gid})`} />
          <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {hover !== null && <line x1={x(i)} x2={x(i)} y1={0} y2={h} stroke="#f2eee6" strokeOpacity="0.35" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        </svg>
        <span
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-bg"
          style={{ left: `${(x(i) / w) * 100}%`, top: `${(y(values[i]) / h) * 100}%`, background: color }}
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-muted">
        <span>{labels?.[0] ?? ""}</span>
        <span>
          low {min.toFixed(1)} · high {max.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
