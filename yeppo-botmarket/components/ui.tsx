"use client";

import { useEffect, useRef, useState } from "react";
import { pct } from "@/lib/format";
import type { Bot } from "@/lib/types";

export function BotAvatar({ bot, size = 28 }: { bot: Pick<Bot, "emoji" | "status">; size?: number }) {
  return (
    <span className={`avatar ${bot.status === "rekt" ? "avatar-rekt" : ""}`} style={{ width: size, height: size, fontSize: size * 0.52 }} aria-hidden>
      {bot.emoji}
    </span>
  );
}

/** Tiny equity curve. */
export function Spark({ points, w = 84, h = 24 }: { points: number[]; w?: number; h?: number }) {
  if (points.length < 2) return <span className="spark-empty" style={{ width: w, height: h }} />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const d = points.map((p, i) => `${(i * step).toFixed(1)},${(h - 2 - ((p - min) / span) * (h - 4)).toFixed(1)}`).join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg className={`spark ${up ? "spark-up" : "spark-down"}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline points={d} fill="none" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** A number that flashes green/red when it changes. */
export function Flash({ value, children, className = "" }: { value: number; children: React.ReactNode; className?: string }) {
  const prev = useRef(value);
  const [f, setF] = useState<{ dir: "up" | "down"; n: number } | null>(null);
  useEffect(() => {
    if (value !== prev.current && isFinite(value) && isFinite(prev.current)) {
      setF((x) => ({ dir: value > prev.current ? "up" : "down", n: (x?.n ?? 0) + 1 }));
    }
    prev.current = value;
  }, [value]);
  return (
    <span key={f?.n ?? 0} className={`${className} ${f ? `fl-${f.dir}` : ""}`}>
      {children}
    </span>
  );
}

export function Stat({ label, children, tone }: { label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div className="stat">
      <span className="lbl">{label}</span>
      <b className={`mono ${tone ? `t-${tone}` : ""}`}>{children}</b>
    </div>
  );
}

export function PositionCell({ bot, open }: { bot: Bot; open: { pct: number } | null }) {
  if (bot.status === "rekt") return <span className="pill pill-rekt">REKT</span>;
  if (!bot.position) return <span className="pill pill-flat">FLAT</span>;
  const p = open?.pct ?? 0;
  return (
    <span className="poscell">
      <span className={`pill pill-${bot.position.side}`}>
        <i className="live" />
        {bot.position.side === "long" ? "LONG" : "SHORT"} {bot.position.lev}x
      </span>
      <Flash value={p} className={`mono t-${p > 0 ? "up" : p < 0 ? "down" : "flat"}`}>
        {pct(p)}
      </Flash>
    </span>
  );
}
