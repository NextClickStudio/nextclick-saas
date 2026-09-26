"use client";

import { useEffect, useState } from "react";
import { Monogram } from "@/components/Monogram";
import { GAME_CONFIG } from "@/config/game";
import { num, pct, timeLeft, tone } from "@/lib/format";
import { useGame } from "@/lib/game/store";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useNow } from "@/lib/useNow";

interface Entry {
  user_id: string;
  name: string;
  monogram: string;
  palette: string[];
  worth: number;
  calls_won: number;
  calls_total: number;
  trophies: number;
}

interface Past {
  season: number;
  rank: number;
  worth: number;
  maison_houses: { name: string; monogram: string; palette: string[] } | null;
}

type Tab = "season" | "forecast" | "fame";

export default function RanksPage() {
  const { state } = useGame();
  const [tab, setTab] = useState<Tab>("season");
  const [board, setBoard] = useState<Entry[] | null>(null);
  const [fame, setFame] = useState<Past[] | null>(null);
  const now = useNow();

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.rpc("maison_leaderboard", { lim: 100 }).then(({ data }) => setBoard((data ?? []) as Entry[]));
    sb.from("maison_trophies")
      .select("season, rank, worth, maison_houses(name, monogram, palette)")
      .lte("rank", GAME_CONFIG.season.trophies)
      .order("season", { ascending: false })
      .order("rank")
      .limit(30)
      .then(({ data }) => setFame((data ?? []) as unknown as Past[]));
  }, []);

  if (!state) return null;
  const me = state.house.user_id;
  const start = GAME_CONFIG.season.startCredits;
  const nose = (board ?? [])
    .filter((e) => e.calls_total >= GAME_CONFIG.forecast.minCallsForBoard)
    .sort((a, b) => b.calls_won / b.calls_total - a.calls_won / a.calls_total || b.calls_total - a.calls_total);

  return (
    <main className="mx-auto max-w-3xl px-5 sm:px-8">
      <header className="pt-[max(env(safe-area-inset-top),24px)]">
        <p className="eyebrow">
          Season {state.season.id} · ends in {timeLeft(new Date(state.season.ends_at).getTime() - now)}
        </p>
        <h1 className="headline mt-3 text-5xl">You&rsquo;re #{state.rank}</h1>
        <p className="mt-2 text-base text-muted">
          of {state.players} maisons. Top {GAME_CONFIG.season.trophies} at the end of the season take a trophy, then everyone restarts from {num(start)} cr.
        </p>
      </header>

      <div className="mt-6 flex gap-2">
        {(
          [
            ["season", "Richest"],
            ["forecast", "Best forecasters"],
            ["fame", "Hall of fame"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-extrabold ${tab === id ? "bg-ivory text-bg" : "bg-surface text-muted"}`}>
            {label}
          </button>
        ))}
      </div>

      {!board ? (
        <div className="mt-6 h-64 animate-pulse rounded-3xl bg-surface" />
      ) : tab === "season" ? (
        <ol className="mt-4 divide-y divide-line rounded-3xl bg-surface px-4">
          {board.map((e, i) => (
            <Row key={e.user_id} i={i} e={e} me={e.user_id === me}>
              <span className="text-right">
                <span className="block font-extrabold tabular-nums">{num(e.worth)}</span>
                <span className="text-xs font-bold tabular-nums" style={{ color: tone(e.worth / start - 1) }}>
                  {pct(e.worth / start - 1)}
                </span>
              </span>
            </Row>
          ))}
        </ol>
      ) : tab === "forecast" ? (
        nose.length ? (
          <ol className="mt-4 divide-y divide-line rounded-3xl bg-surface px-4">
            {nose.map((e, i) => (
              <Row key={e.user_id} i={i} e={e} me={e.user_id === me}>
                <span className="text-right">
                  <span className="block font-extrabold tabular-nums">{Math.round((e.calls_won / e.calls_total) * 100)}%</span>
                  <span className="font-mono text-xs text-muted">
                    {e.calls_won}/{e.calls_total}
                  </span>
                </span>
              </Row>
            ))}
          </ol>
        ) : (
          <p className="mt-10 text-center text-muted">After {GAME_CONFIG.forecast.minCallsForBoard} settled calls you appear here.</p>
        )
      ) : fame && fame.length ? (
        <ol className="mt-4 divide-y divide-line rounded-3xl bg-surface px-4">
          {fame.map((p) => (
            <li key={`${p.season}-${p.rank}`} className="flex items-center gap-3 py-3">
              <span className={`w-16 shrink-0 font-mono text-xs ${p.rank === 1 ? "text-gold" : "text-muted"}`}>
                S{p.season} · #{p.rank}
              </span>
              {p.maison_houses && <Monogram house={p.maison_houses} size={32} />}
              <span className="min-w-0 flex-1 truncate font-bold">{p.maison_houses?.name ?? "A maison"}</span>
              <span className="font-extrabold tabular-nums">{num(p.worth)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-10 text-center text-muted">The first season is still running. Its winners will be written here.</p>
      )}
    </main>
  );
}

function Row({ i, e, me, children }: { i: number; e: Entry; me: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-3 py-3 ${me ? "-mx-4 bg-surface-2 px-4" : ""}`}>
      <span className={`w-7 shrink-0 font-mono text-sm ${i < GAME_CONFIG.season.trophies ? "font-bold text-gold" : "text-muted"}`}>{i + 1}</span>
      <Monogram house={e} size={36} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate ${me ? "font-black" : "font-bold"}`}>
          {e.name}
          {me && " · you"}
        </span>
        {e.trophies > 0 && <span className="font-mono text-[11px] text-gold">{e.trophies} {e.trophies === 1 ? "trophy" : "trophies"}</span>}
      </span>
      {children}
    </li>
  );
}
