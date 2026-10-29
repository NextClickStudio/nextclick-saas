"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { rpc } from "@/lib/supabase";
import { age, compact, usd } from "@/lib/format";
import { coinOf, getFeed, isMint, progressOf, setSolPrice, solPrice, SUPPLY } from "@/lib/pump";
import CoinAvatar from "./CoinAvatar";

type Row = {
  mint: string;
  name: string;
  symbol: string;
  uri: string | null;
  created: number;
  mc: number;
  vsol: number;
  ath: number;
  n: number;
  b5: number;
  s5: number;
  v5: number;
  t1: number;
  x: boolean;
  tg: boolean;
  web: boolean;
  last: number;
  live?: boolean;
};
type PulseRes = {
  now: number;
  sol_usd: number | null;
  coins: [string, string, string, string | null, number, number, number, number, number, number, number, number, number, boolean, boolean, boolean, number][];
};

type Tab = "new" | "hot" | "final";
const TABS: [Tab, string][] = [
  ["new", "New pairs"],
  ["hot", "Trending"],
  ["final", "Final stretch"],
];
const BAD = /(nigg|n1gg|fag|rape|hitler|nazi|kkk|retard|kike|chink|spic|tranny|porn|nsfw|cunt|whore|slut)/i;

/** where live prices come from right now: the PumpPortal socket, or Solana itself while the socket is down */
function FeedDot() {
  const [h, setH] = useState<"live" | "chain">("live");
  useEffect(() => {
    const f = getFeed();
    const t = setInterval(() => setH(f.healthy() ? "live" : "chain"), 2000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className={`feed-dot ${h}`} title={h === "live" ? "Every trade streams in live" : "Live socket reconnecting: prices are read from Solana every second"}>
      <i />
      {h === "live" ? "LIVE" : "CHAIN"}
    </span>
  );
}

/** the coin list on the left of the terminal: fresh launches, what is pumping, what is about to graduate */
export default function Pulse({
  selected,
  onPick,
  onQuick,
  quick,
  setQuick,
  canQuick,
  held,
  onFirst,
}: {
  selected: string | null;
  onPick: (mint: string) => void;
  onQuick: (mint: string) => void;
  quick: number;
  setQuick: (n: number) => void;
  canQuick: boolean;
  held: Set<string>;
  /** called once with the hottest coin, so the terminal never opens empty */
  onFirst?: (mint: string) => void;
}) {
  const rows = useRef(new Map<string, Row>());
  const [ver, setVer] = useState(0);
  const [tab, setTab] = useState<Tab>("new");
  const [q, setQ] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const flash = useRef(new Map<string, { k: number; t: number }>());
  const [editQuick, setEditQuick] = useState(false);

  // captured launches, refreshed every few seconds
  useEffect(() => {
    let dead = false;
    const load = async () => {
      try {
        const r = await rpc<PulseRes>("yr_t_pulse", {});
        if (dead) return;
        setSolPrice(r.sol_usd);
        for (const c of r.coins) {
          const [mint, name, symbol, uri, created, mc, vsol, ath, n, b5, s5, v5, t1, x, tg, web, last] = c;
          const prev = rows.current.get(mint);
          rows.current.set(mint, { mint, name, symbol, uri, created, mc: +mc, vsol: +vsol, ath: +ath, n, b5, s5, v5: +v5, t1, x, tg, web, last, live: prev?.live });
          const coin = coinOf(mint);
          if (!coin.meta.name) coin.meta = { ...coin.meta, name, symbol, uri, created };
        }
        setVer((v) => v + 1);
      } catch {
        /* the next round will do */
      }
    };
    void load();
    const t = setInterval(load, 5000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, []);

  // brand-new launches straight from the feed, before yeppo has captured them
  useEffect(() => {
    const feed = getFeed();
    const off = feed.onNew((c) => {
      if (BAD.test(`${c.name} ${c.symbol}`)) return;
      rows.current.set(c.mint, {
        mint: c.mint,
        name: c.name,
        symbol: c.symbol,
        uri: c.uri,
        created: c.t,
        mc: c.vtok > 0 ? (c.vsol / c.vtok) * SUPPLY : 0,
        vsol: c.vsol,
        ath: 0,
        n: 1,
        b5: 1,
        s5: 0,
        v5: 0,
        t1: 1,
        x: false,
        tg: false,
        web: false,
        last: c.t,
        live: true,
      });
      setVer((v) => v + 1);
    });
    let pending = false;
    const offT = feed.onTrade((mint, t) => {
      if (!rows.current.has(mint)) return;
      flash.current.set(mint, { k: t.k, t: Date.now() });
      if (!pending) {
        pending = true;
        setTimeout(() => {
          pending = false;
          setVer((v) => v + 1);
        }, 250);
      }
    });
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      off();
      offT();
      clearInterval(tick);
    };
  }, []);

  const list = useMemo(() => {
    const all = [...rows.current.values()].filter((r) => now - r.created < 1_800_000);
    const live = (r: Row) => {
      const c = coinOf(r.mint);
      if (c.lastT > r.last && c.vtok > 0) {
        const s = r.live ? c.stats(now) : null;
        return { ...r, mc: c.mc(), vsol: c.vsol, last: c.lastT, prog: c.progress(), ...(s ? { b5: s.buys, s5: s.sells, v5: s.vol } : {}) };
      }
      return { ...r, prog: progressOf(r.vsol > 0 && r.mc > 0 ? (r.vsol * SUPPLY) / r.mc : 1.073e9) };
    };
    const term = q.trim().toLowerCase();
    let out = all.map(live);
    if (term && !isMint(term)) out = out.filter((r) => `${r.name} ${r.symbol}`.toLowerCase().includes(term));
    if (tab === "new") out.sort((a, b) => b.created - a.created);
    else if (tab === "hot") out = out.filter((r) => now - r.last < 90_000).sort((a, b) => b.v5 - a.v5);
    else out = out.filter((r) => r.prog >= 35 && r.prog < 100).sort((a, b) => b.prog - a.prog);
    return out.slice(0, 50);
  }, [ver, now, tab, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstDone = useRef(false);
  useEffect(() => {
    if (firstDone.current || !onFirst || !rows.current.size) return;
    const t = Date.now();
    const best = [...rows.current.values()]
      .filter((r) => t - r.last < 120_000 && t - r.created < 1_800_000)
      .sort((a, b) => b.v5 - a.v5)[0];
    if (best) {
      firstDone.current = true;
      onFirst(best.mint);
    }
  }, [ver, onFirst]);

  // follow the trades of what is on screen
  const watchKey = list
    .slice(0, 40)
    .map((r) => r.mint)
    .join(",");
  useEffect(() => {
    if (!watchKey) return;
    return getFeed().watch(watchKey.split(","));
  }, [watchKey]);

  const su = solPrice();
  const pasted = isMint(q.trim()) ? q.trim() : null;

  return (
    <div className="pulse">
      <div className="pulse-head">
        <div className="pulse-tabs" role="tablist">
          {TABS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="pulse-tools">
          <FeedDot />
          <input
            className="input pulse-search"
            placeholder="Search or paste a CA"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && pasted) {
                onPick(pasted);
                setQ("");
              }
            }}
          />
          {editQuick ? (
            <input
              className="input mono quick-edit"
              autoFocus
              defaultValue={quick}
              inputMode="decimal"
              onBlur={(e) => {
                const v = parseFloat(e.target.value.replace(",", "."));
                if (v > 0) setQuick(Math.min(100, Math.round(v * 1000) / 1000));
                setEditQuick(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <button className="quick-amt mono" title="Quick-buy amount. Click to change." onClick={() => setEditQuick(true)}>
              ⚡ {quick}
            </button>
          )}
        </div>
      </div>
      <div className="pulse-list">
        {pasted && (
          <button
            className="prow open-ca"
            onClick={() => {
              onPick(pasted);
              setQ("");
            }}
          >
            <span className="mono small">Open {pasted.slice(0, 6)}…{pasted.slice(-4)}</span>
            <span className="small dim">any pump.fun coin ↵</span>
          </button>
        )}
        {list.map((r) => {
          const f = flash.current.get(r.mint);
          const fl = f && now - f.t < 900 ? (f.k === 1 ? "fb" : "fs") : "";
          const ath = r.ath > 0 && r.mc > 0 ? r.mc / r.ath : 1;
          return (
            <div
              key={r.mint}
              role="button"
              tabIndex={0}
              className={`prow ${selected === r.mint ? "sel" : ""} ${fl}`}
              onClick={() => onPick(r.mint)}
              onKeyDown={(e) => e.key === "Enter" && onPick(r.mint)}
            >
              <CoinAvatar mint={r.mint} uri={r.uri} sym={r.symbol || r.name} size={36} />
              <div className="prow-mid">
                <div className="prow-l1">
                  <b className="prow-sym">{(r.symbol || r.name).replace(/^\$/, "").slice(0, 10)}</b>
                  <span className="prow-name">{r.name}</span>
                  {held.has(r.mint) && <span className="chip chip-you">BAG</span>}
                </div>
                <div className="prow-l2 mono">
                  <span className={now - r.created < 120_000 ? "t-up" : "dim"}>{age(now - r.created).replace(/ \d+s$/, "")}</span>
                  {r.x && <i className="soc">𝕏</i>}
                  {r.tg && <i className="soc">tg</i>}
                  {r.web && <i className="soc">www</i>}
                  <span className="dim">{r.t1} tx/m</span>
                  <span>
                    <span className="t-up">{r.b5}</span>
                    <span className="dim">/</span>
                    <span className="t-down">{r.s5}</span>
                  </span>
                </div>
                <div className="prow-bar">
                  <i style={{ width: `${r.prog}%` }} className={r.prog > 75 ? "hot" : ""} />
                </div>
              </div>
              <div className="prow-right mono">
                <span className="lbl">MC</span>
                <b className={ath < 0.55 ? "t-down" : ath > 0.97 ? "t-up" : ""}>{usd(r.mc * su)}</b>
                <span className="dim small">V {usd(r.v5 * su)}</span>
              </div>
              <button
                className="qbuy mono"
                data-q={r.mint}
                disabled={!canQuick}
                title={canQuick ? `Buy ${quick} SOL` : "Trading opens when the duel starts"}
                onClick={(e) => {
                  e.stopPropagation();
                  onQuick(r.mint);
                }}
              >
                ⚡{quick}
              </button>
            </div>
          );
        })}
        {!list.length && (
          <p className="small dim pulse-empty">
            {tab === "final" ? "Nothing close to graduating right now." : "Loading live launches…"} <span className="mono">{compact(rows.current.size)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
