"use client";

import { useEffect, useState } from "react";
import { getSolUsd, isMint, searchCoins, type Coin, type Launch } from "@/lib/market";
import { fmtAge, fmtPct, fmtUsd, tone } from "@/lib/format";
import { CoinAvatar } from "../ui";

type Tab = "hot" | "fresh" | "live";

type Props = {
  hot: string[];
  fresh: string[];
  launches: Launch[];
  coins: Record<string, Coin>;
  selected: string | null;
  held: Set<string>;
  now: number;
  onSelect: (mint: string) => void;
  onCoins: (c: Record<string, Coin>) => void;
};

export default function CoinList({ hot, fresh, launches, coins, selected, held, now, onSelect, onCoins }: Props) {
  const [tab, setTab] = useState<Tab>("hot");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Coin[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    setSearching(true);
    let alive = true;
    const t = setTimeout(async () => {
      const found = await searchCoins(q).catch(() => []);
      if (!alive) return;
      setSearching(false);
      setResults(found.slice(0, 30));
      onCoins(Object.fromEntries(found.map((c) => [c.mint, c])));
      if (isMint(q) && found[0]) onSelect(found[0].mint);
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, onCoins, onSelect]);

  const list = tab === "hot" ? hot : fresh;
  const solUsd = getSolUsd();

  return (
    <div className="coinlist">
      <div className="search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Incolla un CA o cerca $ticker"
          spellCheck={false}
          aria-label="Cerca coin"
        />
        {query && (
          <button className="search-x" onClick={() => setQuery("")} aria-label="Pulisci">
            ×
          </button>
        )}
      </div>
      {results === null && (
        <div className="tabs">
          <button className={tab === "hot" ? "on" : ""} onClick={() => setTab("hot")}>
            🔥 Hot
          </button>
          <button className={tab === "fresh" ? "on" : ""} onClick={() => setTab("fresh")}>
            ✨ Nuove
          </button>
          <button className={tab === "live" ? "on" : ""} onClick={() => setTab("live")}>
            <i className="live-dot" /> Lanci
          </button>
        </div>
      )}
      <div className="rows">
        {results !== null ? (
          searching && !results.length ? (
            <div className="rows-empty muted">Cerco…</div>
          ) : results.length ? (
            results.map((c) => <CoinRow key={c.mint} c={c} now={now} on={c.mint === selected} held={held.has(c.mint)} onSelect={onSelect} />)
          ) : (
            <div className="rows-empty muted">Nessuna coin Solana trovata</div>
          )
        ) : tab === "live" ? (
          launches.length ? (
            launches.map((l) => (
              <button key={l.mint} className={`row row-launch ${l.mint === selected ? "on" : ""}`} onClick={() => onSelect(l.mint)}>
                <CoinAvatar symbol={l.symbol} mint={l.mint} size={28} />
                <span className="row-id">
                  <b>
                    ${l.symbol}
                    {now - l.t < 30_000 && <em className="new-tag">NEW</em>}
                  </b>
                  <small>{l.name}</small>
                </span>
                <span className="row-num">
                  <b className="mono">{solUsd ? fmtUsd(l.mcapSol * solUsd) : `${l.mcapSol.toFixed(0)} SOL`}</b>
                  <small className="mono">nata {fmtAge(now - l.t)} fa</small>
                </span>
              </button>
            ))
          ) : (
            <div className="rows-empty muted">
              <i className="live-dot" /> In ascolto dei nuovi lanci su pump.fun…
            </div>
          )
        ) : list.length ? (
          list.map((m) => coins[m] && <CoinRow key={m} c={coins[m]} now={now} on={m === selected} held={held.has(m)} onSelect={onSelect} />)
        ) : (
          <div className="rows-empty muted">Carico il mercato…</div>
        )}
      </div>
    </div>
  );
}

function CoinRow({ c, now, on, held, onSelect }: { c: Coin; now: number; on: boolean; held: boolean; onSelect: (m: string) => void }) {
  return (
    <button className={`row ${on ? "on" : ""}`} onClick={() => onSelect(c.mint)}>
      <CoinAvatar image={c.image} symbol={c.symbol} mint={c.mint} size={28} />
      <span className="row-id">
        <b>
          ${c.symbol}
          {held && <i className="held-dot" title="Ce l'hai in portafoglio" />}
        </b>
        <small>
          {c.createdAt ? fmtAge(now - c.createdAt) : "—"} · liq {c.liqUsd != null ? fmtUsd(c.liqUsd) : "curve"}
        </small>
      </span>
      <span className="row-num">
        <b className="mono">{fmtUsd(c.mcapUsd)}</b>
        <small className={`mono t-${tone(c.chg5m)}`}>{fmtPct(c.chg5m)}</small>
      </span>
    </button>
  );
}
