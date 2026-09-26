"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GAME_CONFIG } from "@/config/game";
import { FAMILIES, FAMILY_LABELS, Family } from "@/lib/cards/catalog";
import type { CardView } from "@/lib/cards/view";
import type { HouseRow } from "@/lib/game/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CardSheet } from "./CardSheet";
import { DOWN, Sparkline, TrendCard, UP } from "./TrendCard";
import { Monogram } from "./Monogram";

const pct = (v: number) => `${v >= 0 ? "▲" : "▼"} ${Math.abs(v * 100).toFixed(1)}%`;

interface Props {
  house: HouseRow;
  worth: number;
  dayChange: number;
  series: number[];
  runway: CardView[];
  cardsCount: number;
  packReady: boolean;
  duel: { me: number; them: number; opponent: string } | null;
  notes: { id: number; kind: string; body: string; created_at: string }[];
  movers: { id: string; name: string; family: Family; change: number }[];
  admin: boolean;
  footer?: React.ReactNode;
}

export function HomeDashboard(p: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<CardView | null>(null);
  const [notes, setNotes] = useState(p.notes);
  const up = p.dayChange >= 0;
  const winning = p.duel ? p.duel.me >= p.duel.them : false;

  const clearNotes = async () => {
    setNotes([]);
    await supabaseBrowser().rpc("maison_mark_read");
    router.refresh();
  };

  const slots = FAMILIES.map((f) => ({ family: f, card: p.runway.find((c) => c.family === f) }));

  return (
    <main className="mx-auto max-w-3xl px-5 sm:px-8">
      <header className="flex items-center justify-between pt-6">
        <div className="flex min-w-0 items-center gap-3">
          <Monogram house={p.house} size={44} />
          <div className="min-w-0">
            <p className="truncate text-lg leading-tight font-extrabold">{p.house.name}</p>
            <p className="font-mono text-xs text-muted">{p.house.credits.toLocaleString("en-US")} cr in cash</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <span className="rounded-full bg-surface px-3 py-2 text-sm font-extrabold" title="Daily pack streak">
            {p.house.streak}d streak
          </span>
          {p.admin && (
            <Link href="/admin" className="rounded-full bg-surface px-3 py-2 text-sm font-extrabold text-muted">
              Admin
            </Link>
          )}
        </div>
      </header>

      {/* Value */}
      <section className="mt-8">
        <p className="eyebrow">Maison value · live</p>
        <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
          <h1 className="headline text-6xl tabular-nums sm:text-7xl">{p.worth.toLocaleString("en-US")}</h1>
          <span className="mb-2 rounded-full bg-surface px-3 py-1.5 text-base font-extrabold tabular-nums" style={{ color: up ? UP : DOWN }}>
            {pct(p.dayChange)} today
          </span>
        </div>
        {p.series.length > 1 && (
          <div className="mt-4 h-24 rounded-3xl bg-surface px-4 py-3">
            <Sparkline values={p.series} up={p.series[p.series.length - 1] >= p.series[0]} className="h-full w-full" />
          </div>
        )}
      </section>

      {/* Pack CTA */}
      {p.packReady && (
        <Link href="/pack" className="mt-4 flex items-center justify-between rounded-3xl bg-ivory p-5 text-bg transition-transform active:scale-[0.99]">
          <div>
            <p className="font-mono text-xs tracking-[0.2em] uppercase opacity-60">Ready</p>
            <p className="headline mt-1 text-2xl">Your daily pack is waiting</p>
          </div>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-bg text-xl font-black text-ivory">M</span>
        </Link>
      )}

      {/* Notifications */}
      {notes.length > 0 && (
        <section className="mt-4 rounded-3xl bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow">News</p>
            <button onClick={clearNotes} className="text-sm font-bold text-muted">
              Clear
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="text-base font-bold">
                {n.body}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Duel */}
      <section className="mt-4 rounded-3xl bg-surface p-5">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Today&rsquo;s duel</p>
          {p.duel && (
            <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${winning ? "bg-ivory text-bg" : "bg-accent text-ivory"}`}>{winning ? "Winning" : "Losing"}</span>
          )}
        </div>
        {p.duel ? (
          <>
            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div>
                <p className="text-lg font-extrabold">You</p>
                <p className="text-2xl font-extrabold tabular-nums" style={{ color: p.duel.me >= 0 ? UP : DOWN }}>
                  {pct(p.duel.me)}
                </p>
              </div>
              <span className="font-mono text-sm text-muted">vs</span>
              <div className="text-right">
                <p className="truncate text-lg font-extrabold">{p.duel.opponent}</p>
                <p className="text-2xl font-extrabold tabular-nums" style={{ color: p.duel.them >= 0 ? UP : DOWN }}>
                  {pct(p.duel.them)}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted">Runways locked at midnight UTC. Closes at the next midnight. Winner takes {GAME_CONFIG.duel.winCredits} cr.</p>
          </>
        ) : (
          <p className="mt-3 text-base text-muted">Your first duel starts at midnight (UTC), with the runway you have then. Fill all five slots.</p>
        )}
      </section>

      {/* Runway */}
      <section className="mt-10">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow">On the runway</p>
            <h2 className="headline mt-2 text-3xl">Your five</h2>
          </div>
          <Link href="/cards" className="text-sm font-bold text-muted">
            All {p.cardsCount} cards
          </Link>
        </div>
        <div className="no-scrollbar -mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0">
          {slots.map(({ family, card }) => (
            <div key={family} className="w-[44vw] shrink-0 snap-start sm:w-auto">
              {card ? (
                <TrendCard card={card} onClick={() => setOpen(card)} />
              ) : (
                <Link
                  href="/cards"
                  className="flex aspect-[5/7] flex-col items-center justify-center rounded-[26px] border-2 border-dashed border-line text-center text-muted"
                >
                  <span className="text-3xl font-black">+</span>
                  <span className="mt-2 text-sm font-bold">{FAMILY_LABELS[family]}</span>
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Movers */}
      <section className="mt-10 rounded-3xl bg-surface p-5">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Market movers · today</p>
          <Link href="/market" className="text-sm font-bold text-muted">
            Market
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-line">
          {p.movers.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2">
              <span className="min-w-0">
                <span className="block truncate font-extrabold">{m.name}</span>
                <span className="font-mono text-xs text-muted">{FAMILY_LABELS[m.family]}</span>
              </span>
              <span className="font-extrabold tabular-nums" style={{ color: m.change >= 0 ? UP : DOWN }}>
                {pct(m.change)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 text-center">{p.footer}</div>

      <CardSheet card={open} onClose={() => setOpen(null)} />
    </main>
  );
}
