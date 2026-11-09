"use client";

// The pieces every film is drawn with: a browser window, the pointer with its click, the yeppo mark, a tick, a
// mask that reveals text upwards. All in stage pixels (1280×800), all black and white.
import type { CSSProperties, ReactNode } from "react";
import { at, k, mix, out } from "./engine";

export function Browser({ x, y, w, h, url, t0 = 0, t, children, extIcon = true, iconLit = 0 }: {
  x: number; y: number; w: number; h: number; url: string; t0?: number; t: number; children?: ReactNode; extIcon?: boolean; iconLit?: number;
}) {
  // the window comes forward from a little below and a little smaller
  const e = k(t, t0, t0 + 0.9);
  return (
    <div
      className="fm-win"
      style={at(x, y, { width: w, height: h, opacity: e, transform: `translateY(${mix(26, 0, e)}px) scale(${mix(0.965, 1, e)})` })}
    >
      <div className="fm-win-bar">
        <span className="fm-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="fm-url">{url}</span>
        {extIcon && (
          <span className="fm-ext" style={{ boxShadow: iconLit ? `0 0 0 ${mix(0, 6, iconLit)}px rgba(255,255,255,${0.18 * (1 - iconLit)})` : undefined }}>
            <Mark size={18} />
          </span>
        )}
      </div>
      <div className="fm-win-body">{children}</div>
    </div>
  );
}

/** the pointer, with a ring when it clicks (clickAt: the second it clicks) */
export function Cursor({ x, y, t, clickAt = [] }: { x: number; y: number; t: number; clickAt?: number[] }) {
  const ring = clickAt.map((c) => k(t, c, c + 0.45)).find((v) => v > 0 && v < 1) ?? 0;
  const press = clickAt.some((c) => t >= c && t < c + 0.12);
  return (
    <div style={at(x, y, { zIndex: 30, pointerEvents: "none" })}>
      {ring > 0 && <span className="fm-ring" style={{ transform: `translate(-50%, -50%) scale(${mix(0.2, 1.6, ring)})`, opacity: 1 - ring }} />}
      <svg width="22" height="26" viewBox="0 0 22 26" style={{ transform: `scale(${press ? 0.86 : 1})`, transformOrigin: "2px 2px", filter: "drop-shadow(0 2px 4px rgba(0,0,0,.6))" }}>
        <path d="M2 2 L2 21 L7.2 16.4 L10.6 24 L14 22.6 L10.7 15.2 L18 15.2 Z" fill="#fff" stroke="#000" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <g transform="rotate(-8 50 50)">
        <circle cx="50" cy="50" r="48" fill="#fff" />
        <path d="M30 27 L50 58 M70 27 L42 82" stroke="#000" strokeWidth="11" fill="none" strokeLinecap="square" />
      </g>
    </svg>
  );
}

/** a check mark drawn in (p: 0 → 1) */
export function Tick({ p, size = 14, color = "#fff" }: { p: number; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden>
      <path d="M2.5 7.4 L5.6 10.4 L11.6 3.6" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="square" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
    </svg>
  );
}

/** text that rises out of its own line */
export function Rise({ p, children, style, className }: { p: number; children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <span className={`fm-rise ${className ?? ""}`} style={style}>
      <span style={{ transform: `translateY(${mix(105, 0, out(p))}%)` }}>{children}</span>
    </span>
  );
}

/** a seeded random walk of candles, the same every time */
export function candles(n: number, seed = 3): { o: number; c: number; h: number; l: number }[] {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let p = 40;
  return Array.from({ length: n }, (_, i) => {
    const drift = i < n * 0.35 ? 1.4 : i < n * 0.55 ? -0.6 : 1.1;
    const o = p;
    const c = Math.max(6, p + drift + (rnd() - 0.5) * 7);
    p = c;
    return { o, c, h: Math.max(o, c) + rnd() * 3, l: Math.min(o, c) - rnd() * 3 };
  });
}

/** the candles drawn into a box, the first `shown` of them */
export function Chart({ w, h, data, shown }: { w: number; h: number; data: ReturnType<typeof candles>; shown: number }) {
  const max = Math.max(...data.map((d) => d.h)), min = Math.min(...data.map((d) => d.l));
  const y = (v: number) => h - ((v - min) / (max - min)) * (h - 20) - 10;
  const cw = w / data.length;
  return (
    <svg width={w} height={h} className="fm-chart">
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1="0" x2={w} y1={h * g} y2={h * g} stroke="#1c1c1c" />
      ))}
      {data.slice(0, Math.ceil(shown)).map((d, i) => {
        const up = d.c >= d.o;
        const grow = Math.min(1, shown - i);
        const top = y(Math.max(d.o, d.c)), bot = y(Math.min(d.o, d.c));
        return (
          <g key={i} opacity={grow}>
            <line x1={i * cw + cw / 2} x2={i * cw + cw / 2} y1={y(d.h)} y2={y(d.l)} stroke={up ? "#e8e8e8" : "#5a5a5a"} />
            <rect x={i * cw + cw * 0.2} width={cw * 0.6} y={top} height={Math.max(1.5, (bot - top) * grow)} fill={up ? "#e8e8e8" : "#000"} stroke={up ? "#e8e8e8" : "#5a5a5a"} />
          </g>
        );
      })}
    </svg>
  );
}
