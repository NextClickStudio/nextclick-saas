"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { DOWN, Sparkline, TrendCard, UP } from "@/components/TrendCard";
import { Wordmark } from "@/components/Wordmark";
import { GAME_CONFIG, RARITIES, Rarity } from "@/config/game";
import { Card, FAMILIES, FAMILY_LABELS, Family, TRENDS, cardValue, drawCard, marketStats, position, sellValue } from "@/lib/cards/catalog";
import { randomSeed } from "@/lib/rng";

const pct = (v: number) => `${v >= 0 ? "▲" : "▼"} ${Math.abs(v * 100).toFixed(1)}%`;

/**
 * Card lab: the new trend cards, the market and the maison dashboard,
 * with demo data. Nothing is saved yet (that's Phase 1–2).
 */
export function LabClient() {
  const [batch, setBatch] = useState("maison");
  const [family, setFamily] = useState<Family | "all">("all");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [open, setOpen] = useState<Card | null>(null);
  const [flipped, setFlipped] = useState(false);

  const cards = useMemo(
    () =>
      Array.from({ length: GAME_CONFIG.lab.gridSize }, (_, i) =>
        drawCard(`${batch}-${i}`, { family: family === "all" ? undefined : family, rarity: rarity === "all" ? undefined : rarity }),
      ),
    [batch, family, rarity],
  );

  // Demo runway: one card per family.
  const runway = useMemo(
    () => FAMILIES.map((f, i) => drawCard(`${batch}-runway-${i}`, { family: f })),
    [batch],
  );

  const maison = useMemo(() => {
    const days = GAME_CONFIG.market.historyDays;
    const series = Array.from({ length: days }, (_, d) =>
      runway.reduce(
        (sum, c) => sum + marketStats(c.trend.id).history[d] * GAME_CONFIG.rarityMultiplier[c.rarity] * GAME_CONFIG.market.creditsPerPoint,
        0,
      ),
    );
    const revenue = series[days - 1];
    return { series, revenue, day: revenue / series[days - 2] - 1, week: revenue / series[days - 8] - 1 };
  }, [runway]);

  const movers = useMemo(() => {
    const all = TRENDS.map((t) => ({ t, s: marketStats(t.id) })).sort((a, b) => b.s.change - a.s.change);
    return { up: all.slice(0, 3), down: all.slice(-3).reverse() };
  }, []);

  const rival = { name: "Maison Ardent", day: maison.day - 0.012 };
  const winning = maison.day >= rival.day;

  const openCard = (c: Card) => {
    setOpen(c);
    setFlipped(false);
  };

  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
      <header className="flex items-center justify-between pt-6">
        <Wordmark />
        <span className="eyebrow rounded-full bg-surface px-4 py-2.5">Lab</span>
      </header>

      {/* Maison dashboard */}
      <section className="mt-8">
        <p className="eyebrow">Your maison · today</p>
        <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
          <h1 className="headline text-6xl tabular-nums sm:text-7xl">{Math.round(maison.revenue).toLocaleString("en-US")}</h1>
          <span className="mb-2 rounded-full bg-surface px-3 py-1.5 text-base font-extrabold tabular-nums" style={{ color: maison.day >= 0 ? UP : DOWN }}>
            {pct(maison.day)}
          </span>
        </div>
        <p className="mt-2 text-lg text-muted">
          Revenue in credits · <span style={{ color: maison.week >= 0 ? UP : DOWN }}>{pct(maison.week)}</span> this week
        </p>
        <div className="mt-4 h-24 rounded-3xl bg-surface px-4 py-3">
          <Sparkline values={maison.series} up={maison.week >= 0} className="h-full w-full" />
        </div>
      </section>

      <section className="mt-3 grid gap-3 md:grid-cols-2">
        {/* Daily duel */}
        <div className="rounded-3xl bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Today&rsquo;s duel</p>
            <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${winning ? "bg-ivory text-bg" : "bg-accent text-ivory"}`}>
              {winning ? "Winning" : "Losing"}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div>
              <p className="text-lg font-extrabold">You</p>
              <p className="text-2xl font-extrabold tabular-nums" style={{ color: maison.day >= 0 ? UP : DOWN }}>
                {pct(maison.day)}
              </p>
            </div>
            <span className="font-mono text-sm text-muted">vs</span>
            <div className="text-right">
              <p className="truncate text-lg font-extrabold">{rival.name}</p>
              <p className="text-2xl font-extrabold tabular-nums" style={{ color: rival.day >= 0 ? UP : DOWN }}>
                {pct(rival.day)}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted">Closes at midnight. Winner takes {GAME_CONFIG.duel.winCredits} cr.</p>
        </div>

        {/* Movers */}
        <div className="rounded-3xl bg-surface p-5">
          <p className="eyebrow">Market movers</p>
          <ul className="mt-3 divide-y divide-line">
            {[...movers.up, ...movers.down].map(({ t, s }) => (
              <li key={t.id} className="flex items-center justify-between py-2">
                <span className="min-w-0">
                  <span className="block truncate font-extrabold">{t.name}</span>
                  <span className="font-mono text-xs text-muted">{FAMILY_LABELS[t.family]}</span>
                </span>
                <span className="font-extrabold tabular-nums" style={{ color: s.change >= 0 ? UP : DOWN }}>
                  {pct(s.change)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Runway */}
      <section className="mt-10">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow">On the runway</p>
            <h2 className="headline mt-2 text-3xl">Your five</h2>
          </div>
          <p className="text-sm text-muted">One per family</p>
        </div>
        <div className="no-scrollbar -mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0">
          {runway.map((c, i) => (
            <div key={i} className="w-[46vw] shrink-0 snap-start sm:w-auto">
              <TrendCard card={c} onClick={() => openCard(c)} />
            </div>
          ))}
        </div>
      </section>

      {/* Every card */}
      <section className="mt-10 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Card lab</p>
          <h2 className="headline mt-2 text-3xl">Every card</h2>
        </div>
        <button
          onClick={() => setBatch(randomSeed())}
          className="rounded-2xl bg-ivory px-6 py-3 text-base font-bold text-bg transition-transform active:scale-[0.97]"
        >
          Draw again
        </button>
      </section>

      <section className="sticky top-0 z-20 -mx-5 mt-4 bg-bg/90 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <Chip active={family === "all"} onClick={() => setFamily("all")}>
            All
          </Chip>
          {FAMILIES.map((f) => (
            <Chip key={f} active={family === f} onClick={() => setFamily(f)}>
              {FAMILY_LABELS[f]}
            </Chip>
          ))}
        </div>
        <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <Chip active={rarity === "all"} onClick={() => setRarity("all")}>
            Any rarity
          </Chip>
          {RARITIES.map((r) => (
            <Chip key={r} active={rarity === r} onClick={() => setRarity(r)}>
              <span className="capitalize">{r}</span>
            </Chip>
          ))}
        </div>
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div
            key={`${batch}-${i}-${family}-${rarity}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: Math.min(i, 12) * 0.035, ease: [0.22, 1, 0.36, 1] }}
          >
            <TrendCard card={c} onClick={() => openCard(c)} />
          </motion.div>
        ))}
      </section>

      {/* Detail sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 overflow-y-auto bg-bg"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <CardSheet card={open} flipped={flipped} onFlip={() => setFlipped((v) => !v)} onClose={() => setOpen(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function CardSheet({ card, flipped, onFlip, onClose }: { card: Card; flipped: boolean; onFlip: () => void; onClose: () => void }) {
  const s = marketStats(card.trend.id);
  const value = cardValue(card, s);
  const sell = sellValue(card, s);
  const expiry = Math.floor(value * GAME_CONFIG.cards.expirySellRate);
  const pos = position(card, s);
  const profit = pos.pnl >= 0;
  const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toLocaleString("en-US")}`;
  return (
    <div className="mx-auto max-w-5xl px-5 pt-6 pb-12 sm:px-8">
      <button onClick={onClose} className="flex items-center gap-2 text-lg font-bold text-muted hover:text-ivory">
        <span aria-hidden>&lsaquo;</span> Back
      </button>
      <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-start">
        <div className="mx-auto w-full max-w-[340px] md:mx-0">
          <TrendCard card={card} flipped={flipped} onClick={onFlip} />
          <p className="mt-3 text-center text-sm text-muted">Tap the card to flip it</p>
        </div>
        <div className="flex-1">
          <p className="eyebrow">
            {FAMILY_LABELS[card.trend.family]} · {card.rarity} · ×{GAME_CONFIG.rarityMultiplier[card.rarity]}
          </p>
          <h2 className="headline mt-3 text-5xl">{card.trend.name}</h2>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Stat
              label={`Since you pulled it at ${pos.boughtAt.toFixed(1)}`}
              value={`${profit ? "+" : "−"}${Math.abs(pos.pnl * 100).toFixed(1)}%`}
              color={profit ? UP : DOWN}
            />
            <Stat label="Profit / loss" value={`${signed(pos.pnlCredits)} cr`} color={profit ? UP : DOWN} />
            <Stat label="Worth now" value={`${value.toLocaleString("en-US")} cr`} />
            <Stat label="Today" value={pct(s.change)} color={s.change >= 0 ? UP : DOWN} />
            <Stat label="Last 7 days" value={pct(s.week)} color={s.week >= 0 ? UP : DOWN} />
            <Stat label="Contract" value={`${card.daysLeft} days`} bar={card.daysLeft / GAME_CONFIG.cards.lifespanDays} />
          </div>
          <div className="mt-3 rounded-3xl bg-surface p-5">
            <p className="text-sm leading-relaxed text-muted">
              {profit ? "It's up. Take the profit now, or hold for more and risk the drop." : "It's down. Cut the loss now, or hold and wait for the rebound."}{" "}
              Selling pays <span className="font-extrabold text-ivory">{sell.toLocaleString("en-US")} cr</span> ({Math.round(GAME_CONFIG.cards.sellFee * 100)}% fee).
              If it expires, it&rsquo;s sold at {Math.round(GAME_CONFIG.cards.expirySellRate * 100)}%: {expiry.toLocaleString("en-US")} cr.
            </p>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              className="flex-1 rounded-2xl py-4 text-lg font-bold text-bg transition-transform active:scale-[0.98]"
              style={{ background: profit ? UP : "#f2eee6" }}
            >
              {profit ? "Take profit" : "Cut loss"} · {sell.toLocaleString("en-US")}
            </button>
            <button className="flex-1 rounded-2xl bg-surface-2 py-4 text-lg font-bold transition-transform active:scale-[0.98]">Hold on runway</button>
          </div>
          <p className="mt-3 text-center font-mono text-xs text-muted">Demo: buttons go live in Phase 2</p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color, bar }: { label: string; value: string; color?: string; bar?: number }) {
  return (
    <div className="rounded-3xl bg-surface p-5">
      <p className="text-2xl font-extrabold tracking-tight tabular-nums" style={color ? { color } : undefined}>
        {value}
      </p>
      {bar !== undefined && (
        <div className="mt-3 h-1.5 rounded-full bg-surface-2">
          <div className={`h-full rounded-full ${bar <= 0.25 ? "bg-accent" : "bg-ivory"}`} style={{ width: `${Math.max(4, bar * 100)}%` }} />
        </div>
      )}
      <p className="mt-2 text-sm text-muted">{label}</p>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors ${active ? "bg-ivory text-bg" : "bg-surface text-muted hover:text-ivory"}`}
    >
      {children}
    </button>
  );
}
