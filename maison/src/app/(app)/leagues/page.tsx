"use client";

import { useEffect, useState } from "react";
import { Bolt, Flame } from "@/components/learn/Icons";
import { Monogram } from "@/components/Monogram";
import { LEARN_CONFIG, leagueOf } from "@/config/learn";
import { timeLeft } from "@/lib/format";
import { type BoardRow, useLearn } from "@/lib/learn/store";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useNow } from "@/lib/useNow";

type AllTime = BoardRow & { streak: number; duels_won: number };

export default function LeaguesPage() {
  const { state } = useLearn();
  const [tab, setTab] = useState<"week" | "all">("week");
  const [all, setAll] = useState<AllTime[] | null>(null);
  const now = useNow();

  useEffect(() => {
    supabaseBrowser()
      .rpc("maison_learn_board", { lim: 100 })
      .then(({ data }) => setAll((data ?? []) as AllTime[]));
  }, []);

  if (!state) return null;
  const me = state.house.user_id;
  const league = leagueOf(state.house.xp);
  const toNext = league.next ? league.next.from - state.house.xp : 0;
  const weekEnd = new Date(`${state.week_start}T00:00:00Z`).getTime() + 7 * 86_400_000;
  const rows: (BoardRow & { streak?: number })[] = tab === "week" ? state.board : (all ?? []);
  const myRank = rows.findIndex((r) => r.user_id === me) + 1;

  return (
    <main className="mx-auto max-w-xl px-5">
      <header className="pt-[max(env(safe-area-inset-top),24px)]">
        <p className="eyebrow">Leagues</p>
        <div className="mt-4 flex items-center gap-4 rounded-3xl bg-surface p-5">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-2xl font-black text-bg" style={{ background: league.color }}>
            {league.name[0]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="headline text-3xl">{league.name} league</p>
            <p className="mt-1 text-sm text-muted">{league.next ? `${toNext} XP to ${league.next.name}` : "The top of fashion. Stay here."}</p>
            {league.next && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${((state.house.xp - league.from) / (league.next.from - league.from)) * 100}%`, background: league.color }}
                />
              </div>
            )}
          </div>
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {LEARN_CONFIG.leagues.map((l, i) => (
            <span
              key={l.name}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold ${i === league.index ? "text-bg" : "bg-surface text-muted"}`}
              style={i === league.index ? { background: l.color } : undefined}
            >
              {l.name}
            </span>
          ))}
        </div>
      </header>

      <div className="mt-6 flex gap-2">
        {(
          [
            ["week", "This week"],
            ["all", "All time"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`rounded-full px-4 py-2 text-sm font-extrabold ${tab === id ? "bg-ivory text-bg" : "bg-surface text-muted"}`}>
            {label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">
        {tab === "week" ? `Weekly XP. Resets in ${timeLeft(weekEnd - now)}.` : "Total XP since you joined."} {myRank ? `You're #${myRank}.` : ""}
      </p>

      {rows.length === 0 ? (
        <p className="mt-10 text-center text-muted">{tab === "week" ? "Nobody has earned XP this week yet. Be the first." : "Loading…"}</p>
      ) : (
        <ol className="mt-4 divide-y divide-line rounded-3xl bg-surface px-4">
          {rows.map((r, i) => {
            const mine = r.user_id === me;
            return (
              <li key={r.user_id} className={`flex items-center gap-3 py-3 ${mine ? "-mx-4 bg-surface-2 px-4" : ""}`}>
                <span className={`w-7 shrink-0 font-mono text-sm ${i < 3 ? "font-bold text-gold" : "text-muted"}`}>{i + 1}</span>
                <Monogram house={r} size={36} />
                <span className={`min-w-0 flex-1 truncate ${mine ? "font-black" : "font-bold"}`}>
                  {r.name}
                  {mine && " · you"}
                </span>
                {r.streak !== undefined && r.streak > 0 && (
                  <span className="flex items-center gap-0.5 text-sm font-bold text-[#ff8a3d]">
                    <Flame className="h-4 w-4" />
                    {r.streak}
                  </span>
                )}
                <span className="flex items-center gap-1 font-extrabold text-gold tabular-nums">
                  <Bolt className="h-4 w-4" />
                  {r.xp}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
