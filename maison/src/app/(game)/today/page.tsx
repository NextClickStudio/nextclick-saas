"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Forecast } from "@/components/Forecast";
import { Monogram } from "@/components/Monogram";
import { Sparkline } from "@/components/TrendCard";
import { GAME_CONFIG } from "@/config/game";
import { FAMILY_LABELS } from "@/lib/cards/families";
import { cr, num, pct, timeLeft, tone } from "@/lib/format";
import { useGame, useListed } from "@/lib/game/store";
import { useNow } from "@/lib/useNow";

export default function TodayPage() {
  const { state, worth, markRead, openSheet } = useGame();
  const listed = useListed();
  const now = useNow();
  const [howTo, setHowTo] = useState(false);

  const movers = useMemo(() => {
    const moves = listed.filter((t) => t.dayOpen).map((t) => ({ t, change: t.value / t.dayOpen - 1 }));
    moves.sort((a, b) => b.change - a.change);
    return { up: moves.slice(0, 3), down: moves.slice(-3).reverse() };
  }, [listed]);

  if (!state) return null;
  const { house, season } = state;
  const start = GAME_CONFIG.season.startCredits;
  const seasonMove = worth / start - 1;
  const packReady = house.last_pack_day !== state.today;
  const callsLeft = state.forecast.filter((f) => !f.dir).length;
  const midnight = new Date(`${state.today}T00:00:00Z`).getTime() + 86_400_000;
  const series = [start, ...state.series, worth];
  const newbie = Object.keys(state.archive).length <= 5 && state.calls.length === 0;

  const steps = [
    {
      done: !packReady,
      title: "Open your free pack",
      body: packReady ? "Five cards. One could be legendary." : `Opened. Next pack in ${timeLeft(midnight - now)}.`,
      href: "/pack",
    },
    {
      done: callsLeft === 0,
      title: "Make your 5 calls",
      body: callsLeft ? `${callsLeft} left. Each right call pays ${num(GAME_CONFIG.forecast.winCredits)} cr.` : "Done. Results in 24 hours.",
      href: "#forecast",
    },
    {
      done: false,
      title: "Trade the market",
      body: "Buy trends before they rise. Sell when they peak.",
      href: "/market",
    },
  ];

  return (
    <main className="mx-auto max-w-3xl px-5 sm:px-8">
      <header className="flex items-center justify-between pt-[max(env(safe-area-inset-top),24px)]">
        <Link href="/maison" className="flex min-w-0 items-center gap-3">
          <Monogram house={house} size={44} />
          <div className="min-w-0">
            <p className="truncate text-lg leading-tight font-extrabold">{house.name}</p>
            <p className="font-mono text-xs text-muted">{cr(house.credits)} cash</p>
          </div>
        </Link>
        <div className="flex shrink-0 gap-2">
          <span className="rounded-full bg-surface px-3 py-2 text-sm font-extrabold" title="Days in a row you opened your pack">
            {house.streak}d streak
          </span>
          {state.admin && (
            <Link href="/admin" className="rounded-full bg-surface px-3 py-2 text-sm font-extrabold text-muted">
              Admin
            </Link>
          )}
        </div>
      </header>

      {/* Season */}
      <section className="mt-6 overflow-hidden rounded-[28px] bg-surface p-5">
        <div className="flex items-center justify-between">
          <p className="eyebrow">
            Season {season.id} · ends in {timeLeft(new Date(season.ends_at).getTime() - now)}
          </p>
          <Link href="/ranks" className="shrink-0 rounded-full bg-ivory px-3 py-1 text-sm font-extrabold whitespace-nowrap text-bg">
            #{state.rank} of {state.players}
          </Link>
        </div>
        <p className="mt-4 text-sm font-bold text-muted">Your maison is worth</p>
        <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
          <h1 className="headline text-6xl tabular-nums">{num(worth)}</h1>
          <span className="mb-1.5 rounded-full bg-bg px-3 py-1 text-base font-extrabold tabular-nums" style={{ color: tone(seasonMove) }}>
            {pct(seasonMove)} this season
          </span>
        </div>
        <div className="mt-3 h-16">
          <Sparkline values={series} up={seasonMove >= 0} className="h-full w-full" />
        </div>
        <p className="mt-2 text-sm text-muted">
          Everyone started with {cr(start)}. The richest maison on {new Date(season.ends_at).toLocaleDateString("en-US", { weekday: "long" })} wins the season.
        </p>
      </section>

      {/* How to play */}
      {(newbie || howTo) && (
        <section className="mt-4 rounded-[28px] bg-ivory p-5 text-bg">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs tracking-[0.2em] uppercase opacity-60">How it works</p>
            {!newbie && (
              <button onClick={() => setHowTo(false)} className="text-sm font-bold opacity-60">
                Close
              </button>
            )}
          </div>
          <ol className="mt-3 space-y-3 text-[15px] leading-snug">
            <li>
              <b>Every card is a real fashion trend.</b> Its price follows how much the world searches for it on Google, live.
            </li>
            <li>
              <b>Collect and trade.</b> Get free cards every day, buy trends you believe in, sell them when they peak. Rare cards are worth up to 2×.
            </li>
            <li>
              <b>Call the market.</b> Five trends a day: rise or fall? Every right call pays {cr(GAME_CONFIG.forecast.winCredits)}.
            </li>
            <li>
              <b>Win the week.</b> Richest maison at the end of the season takes the trophy. Then everyone starts again.
            </li>
          </ol>
        </section>
      )}

      {/* Today's moves */}
      <section className="mt-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow">Today</p>
            <h2 className="headline mt-2 text-3xl">Your three moves</h2>
          </div>
          {!newbie && !howTo && (
            <button onClick={() => setHowTo(true)} className="text-sm font-bold text-muted">
              How it works
            </button>
          )}
        </div>
        <ol className="mt-4 space-y-2">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Link
                href={s.href}
                className={`flex items-center gap-4 rounded-3xl p-4 transition-transform active:scale-[0.99] ${!s.done && i === steps.findIndex((x) => !x.done) ? "bg-ivory text-bg" : "bg-surface"}`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-lg font-black ${s.done ? "bg-bg text-[#5fd08a]" : !s.done && i === steps.findIndex((x) => !x.done) ? "bg-bg text-ivory" : "bg-bg text-muted"}`}
                >
                  {s.done ? "✓" : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg leading-tight font-extrabold">{s.title}</span>
                  <span className="mt-0.5 block text-sm opacity-70">{s.body}</span>
                </span>
                <span aria-hidden className="text-2xl opacity-40">
                  &rsaquo;
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* News */}
      {state.notes.length > 0 && (
        <section className="mt-4 rounded-3xl bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow">News</p>
            <button onClick={markRead} className="text-sm font-bold text-muted">
              Clear
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {state.notes.map((n) => (
              <li key={n.id} className="text-base font-bold">
                {n.body}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div id="forecast" className="scroll-mt-6">
        <Forecast />
      </div>

      {/* Movers */}
      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        {(["up", "down"] as const).map((k) => (
          <div key={k} className="rounded-3xl bg-surface p-5">
            <div className="flex items-center justify-between">
              <p className="eyebrow">{k === "up" ? "Rising today" : "Falling today"}</p>
              <Link href="/market" className="text-sm font-bold text-muted">
                Market
              </Link>
            </div>
            <ul className="mt-2 divide-y divide-line">
              {movers[k].map(({ t, change }) => (
                <li key={t.id}>
                  <button onClick={() => openSheet(t.id)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
                    <span className="min-w-0">
                      <span className="block truncate font-extrabold">{t.name}</span>
                      <span className="font-mono text-xs text-muted">{FAMILY_LABELS[t.family]}</span>
                    </span>
                    <span className="shrink-0 font-extrabold tabular-nums" style={{ color: tone(change) }}>
                      {pct(change)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </main>
  );
}
