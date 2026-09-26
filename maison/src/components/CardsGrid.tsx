"use client";

import { useMemo, useState } from "react";
import { FAMILIES, FAMILY_LABELS, Family } from "@/lib/cards/catalog";
import { CardView, cardNumbers } from "@/lib/cards/view";
import { CardSheet } from "./CardSheet";
import { TrendCard } from "./TrendCard";

type Sort = "value" | "profit" | "expiry";

interface ClosedCard {
  id: string;
  name: string;
  rarity: string;
  status: string;
  closedFor: number;
  closedAt: string;
}

export function CardsGrid({ cards, history }: { cards: CardView[]; history: ClosedCard[] }) {
  const [family, setFamily] = useState<Family | "all">("all");
  const [sort, setSort] = useState<Sort>("value");
  const [open, setOpen] = useState<CardView | null>(null);

  const shown = useMemo(() => {
    const list = cards.filter((c) => family === "all" || c.family === family);
    const key = (c: CardView) => (sort === "value" ? -cardNumbers(c).worth : sort === "profit" ? -cardNumbers(c).pnl : c.daysLeft);
    return [...list].sort((a, b) => key(a) - key(b));
  }, [cards, family, sort]);

  const total = cards.reduce((s, c) => s + cardNumbers(c).worth, 0);

  return (
    <main className="mx-auto max-w-5xl px-5 pt-6 sm:px-8">
      <p className="eyebrow">Your cards</p>
      <h1 className="headline mt-2 text-5xl">{cards.length} cards</h1>
      <p className="mt-2 text-lg text-muted">Worth {total.toLocaleString("en-US")} cr right now. Tap a card to sell it or put it on the runway.</p>

      <div className="sticky top-0 z-20 -mx-5 mt-4 bg-bg/90 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          <Chip active={family === "all"} onClick={() => setFamily("all")}>
            All
          </Chip>
          {FAMILIES.map((f) => (
            <Chip key={f} active={family === f} onClick={() => setFamily(f)}>
              {FAMILY_LABELS[f]}
            </Chip>
          ))}
        </div>
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
          {(["value", "profit", "expiry"] as Sort[]).map((s) => (
            <Chip key={s} active={sort === s} onClick={() => setSort(s)}>
              {s === "value" ? "Most valuable" : s === "profit" ? "Best profit" : "Expiring soon"}
            </Chip>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="mt-6 rounded-3xl bg-surface p-8 text-center text-muted">No cards here yet. Open your daily pack.</div>
      ) : (
        <section className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((c) => (
            <div key={c.id} className="relative">
              <TrendCard card={c} onClick={() => setOpen(c)} />
              {c.onRunway && (
                <span className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-ivory px-3 py-1 text-[11px] font-extrabold text-bg shadow">
                  On runway
                </span>
              )}
            </div>
          ))}
        </section>
      )}

      {history.length > 0 && (
        <section className="mt-10 rounded-3xl bg-surface p-5">
          <p className="eyebrow">Sold &amp; expired</p>
          <ul className="mt-3 divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between py-2">
                <span>
                  <span className="font-extrabold">{h.name}</span>
                  <span className="ml-2 font-mono text-xs text-muted capitalize">
                    {h.rarity} · {h.status}
                  </span>
                </span>
                <span className="font-extrabold tabular-nums">+{h.closedFor.toLocaleString("en-US")} cr</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CardSheet card={open} onClose={() => setOpen(null)} />
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
