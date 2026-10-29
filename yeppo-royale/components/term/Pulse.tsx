"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { rpc } from "@/lib/supabase";
import { age, compact, usd } from "@/lib/format";
import { coinOf, getFeed, isMint, progressOf, setSolPrice, shortAddr, solPrice, SUPPLY, termCall } from "@/lib/pump";
import CoinAvatar from "./CoinAvatar";

type Row = {
  mint: string;
  name: string;
  symbol: string;
  uri: string | null;
  /** null for coins yeppo did not see launch (they come from Trending) */
  created: number | null;
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
  /** in the top of every pump.fun trade of the last 5 minutes */
  hot?: boolean;
};
type PulseRes = {
  now: number;
  sol_usd?: number | null;
  coins: [string, string | null, string | null, string | null, number | null, number, number, number, number, number, number, number, number, boolean, boolean, boolean, number][];
};

type Tab = "new" | "hot" | "final";
const TABS: [Tab, string][] = [
  ["hot", "Trending"],
  ["new", "New pairs"],
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
  const [tab, setTab] = useState<Tab>("hot");
  const [q, setQ] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const flash = useRef(new Map<string, { k: number; t: number }>());
  const [editQuick, setEditQuick] = useState(false);

  // captured launches, and the most traded coins of all pump.fun, refreshed every few seconds
  const named = useRef(new Set<string>());
  useEffect(() => {
    let dead = false;
    const put = (r: PulseRes, hot: boolean) => {
      for (const c of r.coins) {
        const [mint, name, symbol, uri, created, mc, vsol, ath, n, b5, s5, v5, t1, x, tg, web, last] = c;
        const prev = rows.current.get(mint);
        rows.current.set(mint, {
          mint,
          name: name ?? prev?.name ?? "",
          symbol: symbol ?? prev?.symbol ?? "",
          uri: uri ?? prev?.uri ?? null,
          created: created ?? prev?.created ?? null,
          mc: +mc,
          vsol: +vsol,
          ath: Math.max(+ath, prev?.ath ?? 0),
          n,
          b5,
          s5,
          v5: +v5,
          t1,
          x: x || !!prev?.x,
          tg: tg || !!prev?.tg,
          web: web || !!prev?.web,
          last: Math.max(last, prev?.last ?? 0),
          live: prev?.live,
          hot: hot || prev?.hot,
        });
        const coin = coinOf(mint);
        if (!coin.meta.name && name) coin.meta = { ...coin.meta, name, symbol, uri, created };
      }
    };
    const load = async () => {
      try {
        const [p, h] = await Promise.all([rpc<PulseRes>("yr_t_pulse", {}), rpc<PulseRes>("yr_t_hot", {}).catch(() => null)]);
        if (dead) return;
        setSolPrice(p.sol_usd);
        for (const r of rows.current.values()) r.hot = false;
        put(p, false);
        if (h) put(h, true);
        setVer((v) => v + 1);
        // names of traded coins yeppo never captured, read once from the chain
        const unknown = (h?.coins ?? []).filter((c) => !c[1] && !named.current.has(c[0])).map((c) => c[0]).slice(0, 20);
        if (unknown.length) {
          unknown.forEach((m) => named.current.add(m));
          const res = await termCall<{ metas: { mint: string; name: string | null; symbol: string | null; uri: string | null }[] }>({ action: "meta", mints: unknown }).catch(() => null);
          for (const m of res?.metas ?? []) {
            const row = rows.current.get(m.mint);
            if (row) Object.assign(row, { name: m.name ?? "", symbol: m.symbol ?? "", uri: m.uri });
            const coin = coinOf(m.mint);
            if (!coin.meta.name) coin.meta = { ...coin.meta, name: m.name, symbol: m.symbol, uri: m.uri };
          }
          if (!dead) setVer((v) => v + 1);
        }
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
    const all = [...rows.current.values()].filter(
      (r) => !BAD.test(`${r.name} ${r.symbol}`) && ((r.created != null && now - r.created < 1_800_000) || (r.hot && now - r.last < 180_000)),
    );
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
    if (tab === "new") out = out.filter((r) => r.created != null && now - r.created < 1_800_000).sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
    else if (tab === "hot") out = out.filter((r) => now - r.last < 120_000).sort((a, b) => b.t1 - a.t1 || b.v5 - a.v5);
    else out = out.filter((r) => r.prog >= 35 && r.prog < 100).sort((a, b) => b.prog - a.prog);
    return out.slice(0, 50);
  }, [ver, now, tab, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstDone = useRef(false);
  useEffect(() => {
    if (firstDone.current || !onFirst || !rows.current.size) return;
    const t = Date.now();
    // the coin trading the most right now
    const best = [...rows.current.values()]
      .filter((r) => t - r.last < 60_000 && !BAD.test(`${r.name} ${r.symbol}`))
      .sort((a, b) => b.t1 - a.t1 || b.v5 - a.v5)[0];
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
              <CoinAvatar mint={r.mint} uri={r.uri} sym={r.symbol || r.name || r.mint} size={36} />
              <div className="prow-mid">
                <div className="prow-l1">
                  <b className="prow-sym">{(r.symbol || r.name || shortAddr(r.mint)).replace(/^\$/, "").slice(0, 10)}</b>
                  <span className="prow-name">{r.name}</span>
                  {r.hot && tab !== "hot" && <span className="chip chip-hot">HOT</span>}
                  {held.has(r.mint) && <span className="chip chip-you">BAG</span>}
                </div>
                <div className="prow-l2 mono">
                  <span className={r.created != null && now - r.created < 120_000 ? "t-up" : "dim"}>
                    {r.created != null ? age(now - r.created).replace(/ \d+s$/, "") : "—"}
                  </span>
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
