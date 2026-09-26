"use client";

import { useMemo, useState } from "react";
import { FAMILIES, FAMILY_LABELS, Family } from "@/lib/cards/catalog";
import { DOWN, Sparkline, UP } from "./TrendCard";

interface Row {
  id: string;
  name: string;
  family: Family;
  value: number;
  change: number;
  history: number[];
  live: boolean;
  updatedAt: string;
}

type Sort = "up" | "down" | "value" | "name";

export function MarketList({ rows }: { rows: Row[] }) {
  const [family, setFamily] = useState<Family | "all">("all");
  const [sort, setSort] = useState<Sort>("up");
  const shown = useMemo(() => {
    const list = rows.filter((r) => family === "all" || r.family === family);
    const cmp: Record<Sort, (a: Row, b: Row) => number> = {
      up: (a, b) => b.change - a.change,
      down: (a, b) => a.change - b.change,
      value: (a, b) => b.value - a.value,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...list].sort(cmp[sort]);
  }, [rows, family, sort]);
  const liveCount = rows.filter((r) => r.live).length;
  const last = rows.reduce((m, r) => (r.updatedAt > m ? r.updatedAt : m), "");

  return (
    <main className="mx-auto max-w-3xl px-5 pt-6 sm:px-8">
      <p className="eyebrow">The market</p>
      <h1 className="headline mt-2 text-5xl">{rows.length} trends</h1>
      <p className="mt-2 text-base text-muted">
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#5fd08a] align-middle" />
        {liveCount} live from Google search interest · updated every hour
        {last && ` · last move ${new Date(last).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
      </p>

      <div className="sticky top-0 z-20 -mx-5 mt-4 bg-bg/90 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {(["up", "down", "value", "name"] as Sort[]).map((s) => (
            <Chip key={s} active={sort === s} onClick={() => setSort(s)}>
              {s === "up" ? "Rising" : s === "down" ? "Falling" : s === "value" ? "Biggest" : "A–Z"}
            </Chip>
          ))}
        </div>
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
          <Chip active={family === "all"} onClick={() => setFamily("all")}>
            All
          </Chip>
          {FAMILIES.map((f) => (
            <Chip key={f} active={family === f} onClick={() => setFamily(f)}>
              {FAMILY_LABELS[f]}
            </Chip>
          ))}
        </div>
      </div>

      <ul className="mt-2 divide-y divide-line rounded-3xl bg-surface px-5">
        {shown.map((r) => {
          const up = r.change >= 0;
          return (
            <li key={r.id} className="grid grid-cols-[1fr_72px_auto] items-center gap-3 py-3">
              <span className="min-w-0">
                <span className="block truncate text-base font-extrabold">{r.name}</span>
                <span className="font-mono text-xs text-muted">
                  {FAMILY_LABELS[r.family]}
                  {!r.live && " · est."}
                </span>
              </span>
              <Sparkline values={r.history.length > 1 ? r.history : [r.value, r.value]} up={r.history[r.history.length - 1] >= r.history[0]} className="h-8 w-[72px]" />
              <span className="text-right">
                <span className="block text-base font-extrabold tabular-nums">{r.value.toFixed(1)}</span>
                <span className="text-sm font-extrabold tabular-nums" style={{ color: up ? UP : DOWN }}>
                  {up ? "▲" : "▼"} {Math.abs(r.change * 100).toFixed(1)}%
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </main>
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
