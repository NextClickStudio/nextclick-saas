"use client";

import { motion } from "framer-motion";
import { useId, useMemo } from "react";
import { GAME_CONFIG } from "@/config/game";
import { Card, FAMILY_LABELS, cardValue, marketStats, position } from "@/lib/cards/catalog";
import { materialPattern } from "@/lib/cards/materials";
import { luminance } from "@/lib/cards/palette";

export const UP = "#5fd08a";
export const DOWN = "#ff5a3d";

interface Props {
  card: Card;
  flipped?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * A trend card. Typography first: the trend name is the artwork, the market
 * numbers are the drama. Sizes use container units, so the card scales cleanly.
 */
export function TrendCard({ card, flipped = false, onClick, className = "" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${card.trend.name}, ${card.rarity}`}
      className={`group relative block aspect-[5/7] w-full [perspective:1200px] ${className}`}
    >
      <motion.div
        className="preserve-3d absolute inset-0"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="backface-hidden absolute inset-0">
          <CardFront card={card} />
        </div>
        <div className="backface-hidden absolute inset-0 [transform:rotateY(180deg)]">
          <CardBack />
        </div>
      </motion.div>
    </button>
  );
}

function Edge({ rarity, children }: { rarity: Card["rarity"]; children: React.ReactNode }) {
  if (rarity === "common") {
    return <div className="h-full w-full rounded-[26px] bg-surface ring-1 ring-line">{children}</div>;
  }
  const glow = rarity === "legendary" ? "shadow-[0_0_28px_rgba(212,173,85,0.35)]" : rarity === "epic" ? "shadow-[0_0_22px_rgba(229,69,45,0.25)]" : "";
  return (
    <div className={`edge-${rarity} h-full w-full rounded-[26px] p-[2px] ${glow}`}>
      <div className="h-full w-full rounded-[24px] bg-surface">{children}</div>
    </div>
  );
}

export function CardFront({ card }: { card: Card }) {
  const stats = useMemo(() => marketStats(card.trend.id), [card.trend.id]);
  const up = stats.change >= 0;
  const value = cardValue(card, stats);
  const mult = GAME_CONFIG.rarityMultiplier[card.rarity];
  const expiring = card.daysLeft <= 3;
  const pos = position(card, stats);

  return (
    <Edge rarity={card.rarity}>
      <div className="@container flex h-full flex-col p-[4.5cqw] text-left">
        {/* Top row */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-[3.6cqw] tracking-[0.2em] text-muted uppercase">{FAMILY_LABELS[card.trend.family]}</span>
          <RarityPill rarity={card.rarity} />
        </div>

        {/* Artwork */}
        <div className={`relative mt-[3cqw] flex-1 overflow-hidden rounded-[18px] ${card.rarity === "legendary" ? "shimmer" : ""}`}>
          <Artwork card={card} />
          <div className="absolute top-[3cqw] right-[3cqw] flex gap-[1.5cqw]">
            {pos.ath && <Badge className="bg-ivory text-bg">ATH</Badge>}
            {pos.hype && (
              <Badge className="bg-bg" style={{ color: pos.hype === "pumping" ? UP : DOWN }}>
                {pos.hype === "pumping" ? "Pumping" : "Dumping"}
              </Badge>
            )}
          </div>
        </div>

        {/* Market */}
        <div className="mt-[3.5cqw] flex items-end justify-between gap-[2cqw]">
          <div className="min-w-0">
            <p className="text-[9.5cqw] leading-none font-extrabold tracking-[-0.04em] tabular-nums">{stats.value.toFixed(1)}</p>
            <p className="mt-[1cqw] font-mono text-[3.2cqw] text-muted">index · 30d</p>
          </div>
          <div className="shrink-0 text-right">
            <span
              className="inline-block rounded-full bg-bg px-[3cqw] py-[1.4cqw] text-[4.4cqw] font-extrabold tabular-nums"
              style={{ color: up ? UP : DOWN }}
            >
              {up ? "▲" : "▼"} {Math.abs(stats.change * 100).toFixed(1)}%
            </span>
            <p className="mt-[1cqw] font-mono text-[3.2cqw] text-muted">today</p>
          </div>
        </div>
        <Sparkline values={stats.history} up={stats.history[stats.history.length - 1] >= stats.history[0]} />

        {/* Footer */}
        <div className="mt-[2.5cqw] flex items-center justify-between font-mono text-[3.3cqw] text-muted">
          <span title={`Worth ${value.toLocaleString("en-US")} cr${mult > 1 ? ` · ×${mult}` : ""}`}>
            <span className="font-bold" style={{ color: pos.pnl >= 0 ? UP : DOWN }}>
              {pos.pnl >= 0 ? "+" : "−"}
              {Math.abs(pos.pnl * 100).toFixed(0)}%
            </span>{" "}
            since pull
          </span>
          <span className={expiring ? "font-bold text-accent" : ""}>{card.daysLeft}d left</span>
        </div>
      </div>
    </Edge>
  );
}

function Badge({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`rounded-full px-[2.4cqw] py-[0.9cqw] text-[3.2cqw] font-extrabold ${className}`} style={style}>
      {children}
    </span>
  );
}

function RarityPill({ rarity }: { rarity: Card["rarity"] }) {
  const cls = {
    common: "bg-surface-2 text-muted",
    rare: "bg-ivory text-bg",
    epic: "bg-accent text-ivory",
    legendary: "bg-gold text-bg",
  }[rarity];
  return <span className={`rounded-full px-[2.6cqw] py-[1cqw] text-[3.4cqw] font-extrabold capitalize ${cls}`}>{rarity}</span>;
}

/** Font size so the longest word fits on one line. */
function nameSize(name: string, max = 15) {
  const longest = Math.max(...name.split(/[\s-]/).map((w) => w.length));
  return Math.min(max, 70 / (longest * 0.6));
}

function Artwork({ card }: { card: Card }) {
  const t = card.trend;
  const size = nameSize(t.name);
  const title = (color: string) => (
    <h3 className="pb-[1cqw] text-balance break-words" style={{ fontSize: `${size}cqw`, lineHeight: 0.95, letterSpacing: "-0.045em", fontWeight: 900, color }}>
      {t.name}
    </h3>
  );
  const serial = (color: string) => (
    <span className="font-mono text-[3.2cqw] tracking-[0.12em]" style={{ color }}>
      No. {String(card.serial).padStart(4, "0")}
    </span>
  );

  switch (t.family) {
    case "piece":
      return (
        <div className="flex h-full flex-col justify-between bg-ivory p-[4cqw]">
          {serial("#6b665e")}
          {title("#0e0e0d")}
        </div>
      );
    case "detail":
      return (
        <div className="flex h-full flex-col justify-between bg-surface-2 p-[4cqw]">
          {serial("#9b968e")}
          {title("#f2eee6")}
        </div>
      );
    case "color": {
      const ink = luminance(t.hex!) > 0.5 ? "#0e0e0d" : "#f2eee6";
      return (
        <div className="flex h-full flex-col justify-between p-[4cqw]" style={{ background: t.hex }}>
          <span className="font-mono text-[3.2cqw] tracking-[0.12em] uppercase" style={{ color: ink, opacity: 0.75 }}>
            {t.hex}
          </span>
          {title(ink)}
        </div>
      );
    }
    case "aesthetic": {
      const [a, b] = t.mood!;
      const ink = luminance(a) * 0.4 + luminance(b) * 0.6 > 0.5 ? "#0e0e0d" : "#f2eee6";
      return (
        <div className="flex h-full flex-col justify-between p-[4cqw]" style={{ background: `radial-gradient(120% 90% at 20% 10%, ${a}, ${b})` }}>
          {serial(ink)}
          {title(ink)}
        </div>
      );
    }
    case "material":
      return <MaterialArt card={card} title={title} />;
  }
}

function MaterialArt({ card, title }: { card: Card; title: (c: string) => React.ReactNode }) {
  const m = card.trend.material!;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const pattern = materialPattern(m, uid, m.main, m.accent, card.trend.id);
  const sheen = m.id === "satin" || m.id === "leather";
  return (
    <div className="relative h-full" style={{ background: m.main }}>
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
        <defs dangerouslySetInnerHTML={{ __html: pattern ?? "" }} />
        {pattern && <rect width="100%" height="100%" fill={`url(#${uid}-mat)`} />}
        {sheen && (
          <>
            <defs>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0.2" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.38" stopColor="#fff" stopOpacity="0.35" />
                <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.66" stopColor="#fff" stopOpacity="0.18" />
                <stop offset="0.8" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${uid}-sheen)`} />
          </>
        )}
      </svg>
      <div className="absolute inset-x-[3cqw] bottom-[3cqw] rounded-[14px] bg-bg/85 p-[3cqw] backdrop-blur-sm">{title("#f2eee6")}</div>
    </div>
  );
}

export function Sparkline({ values, up, className = "mt-[2.5cqw] h-[11cqw] w-full" }: { values: number[]; up: boolean; className?: string }) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const w = 100;
  const h = 26;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 2 - ((v - min) / (max - min || 1)) * (h - 4)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const color = up ? UP : DOWN;
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`overflow-visible ${className}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="1.8" fill={color} />
    </svg>
  );
}

export function CardBack() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[26px] bg-surface ring-1 ring-line">
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle at center, #f2eee6 1.2px, transparent 1.4px)",
          backgroundSize: "14px 14px",
        }}
      />
      <div className="@container relative flex h-full flex-col items-center justify-center gap-[4cqw]">
        <span className="grid h-[26cqw] w-[26cqw] place-items-center rounded-[7cqw] bg-ivory text-[14cqw] font-black text-bg">M</span>
        <span className="text-[9cqw] font-extrabold tracking-[-0.04em]">maison</span>
        <span className="font-mono text-[3.2cqw] tracking-[0.3em] text-muted uppercase">Trend card</span>
      </div>
    </div>
  );
}

