"use client";

import { memo, useDeferredValue, useMemo, useState } from "react";
import { Swatch } from "@/components/Swatch";
import { Sparkline } from "@/components/TrendCard";
import { cardWorth } from "@/config/game";
import { FAMILIES, FAMILY_LABELS, FAMILY_PLURAL, Family } from "@/lib/cards/families";
import { ago, num, pct, tone } from "@/lib/format";
import { useGame } from "@/lib/game/store";
import type { Trend } from "@/lib/game/types";

type Sort = "hot" | "gainers" | "losers" | "month" | "az";
const SORTS: { id: Sort; label: string }[] = [
  { id: "hot", label: "Moving" },
  { id: "gainers", label: "Gainers" },
  { id: "losers", label: "Losers" },
  { id: "month", label: "30 days" },
  { id: "az", label: "A–Z" },
];

const day = (t: Trend) => (t.dayOpen ? t.value / t.dayOpen - 1 : 0);
const month = (t: Trend) => (t.history[0] ? t.value / t.history[0] - 1 : 0);

export default function MarketPage() {
  const { market, state, ticks, openSheet } = useGame();
  const [family, setFamily] = useState<Family | "all" | "mine">("all");
  const [sort, setSort] = useState<Sort>("hot");
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());

  const all = useMemo(() => (market ? [...market.values()] : []), [market]);
  const listed = useMemo(() => all.filter((t) => t.listed), [all]);
  const unlisted = all.length - listed.length;
  const held = useMemo(() => new Set(state?.cards.map((c) => c.trend_id)), [state]);
  const lastUpdate = listed.reduce((m, t) => (t.updatedAt > m ? t.updatedAt : m), "");

  const rows = useMemo(() => {
    let list = listed;
    if (family === "mine") list = list.filter((t) => held.has(t.id));
    else if (family !== "all") list = list.filter((t) => t.family === family);
    if (q) list = list.filter((t) => t.name.toLowerCase().includes(q) || FAMILY_LABELS[t.family].toLowerCase().includes(q));
    const by: Record<Sort, (a: Trend, b: Trend) => number> = {
      hot: (a, b) => Math.abs(day(b)) - Math.abs(day(a)),
      gainers: (a, b) => day(b) - day(a),
      losers: (a, b) => day(a) - day(b),
      month: (a, b) => month(b) - month(a),
      az: (a, b) => a.name.localeCompare(b.name),
    };
    return [...list].sort(by[sort]);
  }, [listed, family, q, sort, held]);

  const up = listed.filter((t) => day(t) > 0).length;

  return (
    <main className="mx-auto max-w-3xl px-5 sm:px-8">
      <header className="pt-[max(env(safe-area-inset-top),24px)]">
        <div className="flex items-center justify-between">
          <p className="eyebrow flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#5fd08a]" /> Live · {lastUpdate ? ago(lastUpdate) : "loading"}
          </p>
          <p className="shrink-0 font-mono text-xs text-muted">
            {up} up · {listed.length - up} down
          </p>
        </div>
        <h1 className="headline mt-3 text-5xl">The market</h1>
        <p className="mt-2 text-base text-muted">
          {listed.length} fashion trends, priced by what the world searches on Google. Tap one to buy it.
        </p>
      </header>

      <div className="sticky top-0 z-20 -mx-5 mt-5 bg-bg/95 px-5 pt-2 pb-3 backdrop-blur sm:-mx-8 sm:px-8">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search trends"
          className="w-full rounded-2xl bg-surface px-4 py-3 text-base font-bold placeholder:text-muted focus:ring-2 focus:ring-ivory/30 focus:outline-none"
        />
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 sm:-mx-8 sm:px-8">
          {(["all", "mine", ...FAMILIES] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFamily(f)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-extrabold ${family === f ? "bg-ivory text-bg" : "bg-surface text-muted"}`}
            >
              {f === "all" ? "All" : f === "mine" ? `Mine · ${held.size}` : FAMILY_PLURAL[f]}
            </button>
          ))}
        </div>
        <div className="no-scrollbar -mx-5 mt-2 flex gap-4 overflow-x-auto px-5 sm:-mx-8 sm:px-8">
          {SORTS.map((s) => (
            <button key={s.id} onClick={() => setSort(s.id)} className={`shrink-0 py-1 text-sm font-extrabold ${sort === s.id ? "text-ivory" : "text-muted"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {unlisted > 0 && family === "all" && !q && (
        <div className="mt-2 flex items-center gap-3 rounded-3xl border border-dashed border-line p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-surface font-black">+{unlisted}</span>
          <p className="text-sm text-muted">
            <span className="font-bold text-ivory">New listings coming.</span> We&rsquo;re pricing {unlisted} more trends from their real Google history. New ones
            land every few minutes.
          </p>
        </div>
      )}

      <ul className="mt-2 divide-y divide-line">
        {rows.map((t) => (
          <Row key={t.id} t={t} owned={held.has(t.id)} tick={ticks[t.id]} onOpen={openSheet} />
        ))}
      </ul>
      {rows.length === 0 && <p className="py-16 text-center text-muted">{family === "mine" ? "You don't own any trend yet." : "No trend matches."}</p>}
    </main>
  );
}

const Row = memo(function Row({
  t,
  owned,
  tick,
  onOpen,
}: {
  t: Trend;
  owned: boolean;
  tick?: { at: number; dir: 1 | -1 };
  onOpen: (id: string) => void;
}) {
  const change = day(t);
  const fresh = !!tick;
  return (
    <li style={{ contentVisibility: "auto", containIntrinsicSize: "0 72px" }}>
      <button onClick={() => onOpen(t.id)} className="flex w-full items-center gap-3 py-3 text-left active:opacity-70">
        <Swatch family={t.family} style={t.style} name={t.name} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[17px] font-extrabold">{t.name}</span>
            {owned && <span className="shrink-0 rounded-full bg-ivory px-2 py-0.5 text-[10px] font-black text-bg uppercase">Owned</span>}
          </span>
          <span className="font-mono text-xs text-muted">
            {FAMILY_LABELS[t.family]} · {num(cardWorth(t.value, "common"))} cr
          </span>
        </span>
        <span className="hidden w-20 shrink-0 sm:block">
          <Sparkline values={t.history} up={month(t) >= 0} className="h-8 w-full" />
        </span>
        <span className="w-[92px] shrink-0 text-right">
          <span
            className={`block text-lg font-extrabold tabular-nums transition-colors duration-700 ${fresh ? "rounded-md" : ""}`}
            style={tick ? { background: tick.dir > 0 ? "#5fd08a33" : "#ff5a3d33" } : undefined}
          >
            {t.value.toFixed(1)}
          </span>
          <span className="text-sm font-extrabold tabular-nums" style={{ color: tone(change) }}>
            {pct(change)}
          </span>
        </span>
      </button>
    </li>
  );
});
