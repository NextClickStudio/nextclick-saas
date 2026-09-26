"use client";

import { useMemo, useState } from "react";
import { Monogram } from "@/components/Monogram";
import { Swatch } from "@/components/Swatch";
import { TrendCard } from "@/components/TrendCard";
import { cardWorth, GAME_CONFIG, Rarity } from "@/config/game";
import { FAMILIES, FAMILY_PLURAL } from "@/lib/cards/families";
import { num, pct, signed, tone } from "@/lib/format";
import { trendCard, useGame } from "@/lib/game/store";

type Tab = "cards" | "archive";
type Sort = "worth" | "gain" | "new";

const RARITY_RING: Record<Rarity, string> = {
  common: "ring-line",
  rare: "ring-ivory/70",
  epic: "ring-accent",
  legendary: "ring-gold",
};

export default function MaisonPage() {
  const { state, market, worth, openSheet, signOut } = useGame();
  const [tab, setTab] = useState<Tab>("cards");
  const [sort, setSort] = useState<Sort>("worth");

  const views = useMemo(() => {
    if (!state || !market) return [];
    const list = state.cards.filter((c) => market.has(c.trend_id)).map((c) => trendCard(market.get(c.trend_id)!, c));
    const gain = (v: (typeof list)[number]) => v.value / (v.boughtAt ?? v.value) - 1;
    if (sort === "worth") list.sort((a, b) => cardWorth(b.value, b.rarity) - cardWorth(a.value, a.rarity));
    if (sort === "gain") list.sort((a, b) => gain(b) - gain(a));
    return list;
  }, [state, market, sort]);

  if (!state || !market) return null;
  const { house } = state;
  const holdings = worth - house.credits;
  const cost = state.cards.reduce((s, c) => s + cardWorth(c.bought_at, c.rarity), 0);
  const pnl = holdings - cost;
  const all = [...market.values()];
  const collected = Object.keys(state.archive).filter((id) => market.has(id)).length;
  const calls = house.calls_total;

  return (
    <main className="mx-auto max-w-3xl px-5 sm:px-8">
      <header className="flex items-center gap-4 pt-[max(env(safe-area-inset-top),24px)]">
        <Monogram house={house} size={64} />
        <div className="min-w-0">
          <h1 className="headline truncate text-3xl">{house.name}</h1>
          {house.manifesto && <p className="mt-1 line-clamp-2 text-sm text-muted">{house.manifesto}</p>}
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <Stat label="Maison value" value={num(worth)} />
        <Stat label="Cash" value={num(house.credits)} />
        <Stat label="Cards, at today's prices" value={num(holdings)} />
        <Stat label="Profit on cards" value={signed(pnl)} color={tone(pnl)} />
        <Stat label="Forecast accuracy" value={calls ? `${Math.round((house.calls_won / calls) * 100)}%` : "–"} sub={`${house.calls_won} of ${calls} calls`} />
        <Stat label="Archive" value={`${collected}/${all.length}`} sub="trends collected" />
      </section>

      {state.trophies.some((t) => t.rank <= GAME_CONFIG.season.trophies) && (
        <section className="mt-3 flex gap-2 overflow-x-auto rounded-3xl bg-surface p-4">
          {state.trophies
            .filter((t) => t.rank <= GAME_CONFIG.season.trophies)
            .map((t) => (
              <span key={t.season} className={`shrink-0 rounded-2xl px-4 py-3 text-center ${t.rank === 1 ? "bg-gold text-bg" : "bg-surface-2"}`}>
                <span className="block text-2xl font-black">#{t.rank}</span>
                <span className="font-mono text-xs">Season {t.season}</span>
              </span>
            ))}
        </section>
      )}

      <div className="mt-8 flex gap-2">
        {(["cards", "archive"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-5 py-2.5 font-extrabold ${tab === t ? "bg-ivory text-bg" : "bg-surface text-muted"}`}>
            {t === "cards" ? `Cards · ${state.cards.length}` : "Archive"}
          </button>
        ))}
      </div>

      {tab === "cards" ? (
        <>
          <div className="mt-4 flex gap-4">
            {(
              [
                ["worth", "Worth"],
                ["gain", "Profit"],
                ["new", "Newest"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} onClick={() => setSort(id)} className={`text-sm font-extrabold ${sort === id ? "text-ivory" : "text-muted"}`}>
                {label}
              </button>
            ))}
          </div>
          {views.length ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {views.map((v) => (
                <TrendCard key={v.id} card={v} onClick={() => openSheet(v.trendId, v.id)} />
              ))}
            </div>
          ) : (
            <p className="mt-10 text-center text-muted">No cards yet. Open your pack or buy a trend on the market.</p>
          )}
          {views.length > 0 && <p className="mt-4 text-center text-sm text-muted">Tap a card to sell it. {pct(holdings / (cost || 1) - 1)} on everything you hold.</p>}
        </>
      ) : (
        <section className="mt-4">
          <p className="text-sm text-muted">Every trend you&rsquo;ve pulled from a pack, forever. Your best rarity is kept. Collect them all.</p>
          {FAMILIES.map((f) => {
            const list = all.filter((t) => t.family === f).sort((a, b) => a.name.localeCompare(b.name));
            if (!list.length) return null;
            const got = list.filter((t) => state.archive[t.id]).length;
            return (
              <div key={f} className="mt-6">
                <div className="flex items-center justify-between">
                  <p className="font-extrabold">{FAMILY_PLURAL[f]}</p>
                  <p className="font-mono text-xs text-muted">
                    {got}/{list.length}
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-ivory" style={{ width: `${(got / list.length) * 100}%` }} />
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {list.map((t) => {
                    const a = state.archive[t.id];
                    return (
                      <button
                        key={t.id}
                        onClick={() => openSheet(t.id)}
                        className={`flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center ring-1 ${a ? `bg-surface ${RARITY_RING[a.r]}` : "ring-line/50"}`}
                        title={a ? `${a.r}, pulled ${a.n}×` : "Not collected yet"}
                      >
                        <span className={a ? "" : "opacity-20 grayscale"}>
                          <Swatch family={t.family} style={t.style} name={t.name} size={40} />
                        </span>
                        <span className={`line-clamp-2 text-[11px] leading-tight font-bold ${a ? "" : "text-muted/50"}`}>{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <div className="mt-12 flex justify-center">
        <button onClick={signOut} className="text-sm font-bold text-muted underline-offset-4 hover:underline">
          Sign out
        </button>
      </div>
      <p className="mt-2 text-center font-mono text-[11px] text-muted">Credits are play money. They can&rsquo;t be bought or cashed out.</p>
    </main>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-3xl bg-surface p-4">
      <p className="text-2xl font-extrabold tracking-tight tabular-nums" style={color ? { color } : undefined}>
        {value}
      </p>
      <p className="mt-1 text-sm text-muted">{label}</p>
      {sub && <p className="font-mono text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

