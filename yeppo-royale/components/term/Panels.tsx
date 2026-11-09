"use client";

import { useEffect, useState } from "react";
import { compact, pct, signed, sol, usd } from "@/lib/format";
import { type Coin, coinOf, type Holder, shortAddr, solPrice, SUPPLY, topHolders } from "@/lib/pump";
import CoinAvatar from "./CoinAvatar";

export type Bag = { mint: string; sym: string; uri: string | null; held: number; cost: number; got: number; n: number };
export type DuelMark = { mint: string; t: number; k: 1 | 2; who: "me" | "opp"; sol: number; tok: number; px: number };

const clockOf = (t: number) => new Date(t).toLocaleTimeString("en-GB", { hour12: false });

/** every trade on the coin, newest first; the duelists' own fills stand out */
export function Tape({ coin, version, marks, me, opp }: { coin: Coin; version: number; marks: DuelMark[]; me?: string | null; opp?: string | null }) {
  void version;
  const su = solPrice();
  const meS = me ? shortAddr(me) : null;
  const oppS = opp ? shortAddr(opp) : null;
  type Row = { key: string; t: number; k: 1 | 2; sol: number; tok: number; px: number; who: string; tag: "me" | "opp" | null };
  const rows: Row[] = coin.trades.slice(-80).map((t) => {
    const s = shortAddr(t.who);
    return { key: t.sig, t: t.t, k: t.k, sol: t.sol, tok: t.tok, px: t.vsol / t.vtok, who: t.who.startsWith("w") && t.who.length < 8 ? "" : s, tag: s === meS ? "me" : s === oppS ? "opp" : null };
  });
  for (const m of marks) {
    if (m.mint !== coin.mint) continue;
    rows.push({ key: `m${m.t}${m.k}${m.who}`, t: m.t, k: m.k, sol: m.sol, tok: m.tok, px: m.px, who: m.who === "me" ? "you" : "opponent", tag: m.who });
  }
  rows.sort((a, b) => b.t - a.t);
  return (
    <div className="tape">
      <div className="tape-row head">
        <span>Time</span>
        <span>Type</span>
        <span className="num">MC</span>
        <span className="num">SOL</span>
        <span className="num">{coin.sym}</span>
        <span className="num">Trader</span>
      </div>
      {rows.slice(0, 80).map((r) => (
        <div key={r.key} className={`tape-row ${r.k === 1 ? "b" : "s"} ${r.tag ? `tag-${r.tag}` : ""}`}>
          <span className="mono dim">{clockOf(r.t)}</span>
          <span className={`mono ${r.k === 1 ? "t-up" : "t-down"}`}>{r.k === 1 ? "Buy" : "Sell"}</span>
          <span className="mono num">{usd(r.px * SUPPLY * su)}</span>
          <span className={`mono num ${r.sol >= 2 ? "big" : ""}`}>{sol(r.sol, 3)}</span>
          <span className="mono num dim">{compact(r.tok)}</span>
          <span className="mono num">
            {r.tag ? <span className={`chip ${r.tag === "me" ? "chip-you" : "chip-ghost"}`}>{r.tag === "me" ? "YOU" : "OPP"}</span> : <span className="dim">{r.who}</span>}
          </span>
        </div>
      ))}
      {!rows.length && <p className="small dim tape-empty">No trades yet.</p>}
    </div>
  );
}

/** open bags with their live value; click one to jump to its chart */
export function Bags({ bags, onPick, onSellAll, canTrade, empty }: { bags: Bag[]; onPick: (m: string) => void; onSellAll?: (m: string) => void; canTrade: boolean; empty: string }) {
  const su = solPrice();
  const open = bags.filter((b) => b.held > 0 || b.n > 0);
  return (
    <div className="bags">
      {open.map((b) => {
        const c = coinOf(b.mint);
        const value = b.held * c.price() * 0.99;
        const pnl = value + b.got - b.cost;
        return (
          <div key={b.mint} className="bag-row" role="button" tabIndex={0} onClick={() => onPick(b.mint)} onKeyDown={(e) => e.key === "Enter" && onPick(b.mint)}>
            <CoinAvatar mint={b.mint} uri={b.uri ?? c.meta.uri} sym={b.sym} size={26} />
            <div className="bag-mid">
              <b>{b.sym}</b>
              <span className="mono small dim">
                {b.held > 0 ? `${compact(b.held)} · MC ${usd(c.mc() * su)}` : "closed"} · {b.n} trades
              </span>
            </div>
            <div className="bag-num mono">
              <b className={pnl >= 0 ? "t-up" : "t-down"}>{signed(pnl, 3)}</b>
              <span className="small dim">{b.cost > 0 ? pct((pnl / b.cost) * 100, 0) : ""}</span>
            </div>
            {onSellAll && b.held > 0 && (
              <button
                className="btn btn-sm btn-sell"
                disabled={!canTrade}
                onClick={(e) => {
                  e.stopPropagation();
                  onSellAll(b.mint);
                }}
              >
                Sell all
              </button>
            )}
          </div>
        );
      })}
      {!open.length && <p className="small dim tape-empty">{empty}</p>}
    </div>
  );
}

/** the 20 biggest wallets on the coin, read from the chain */
export function Holders({ coin, me }: { coin: Coin; me?: string | null }) {
  const [rows, setRows] = useState<Holder[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let dead = false;
    setRows(null);
    setErr(false);
    const go = () =>
      topHolders(coin)
        .then((r) => !dead && setRows(r))
        .catch(() => !dead && setErr(true));
    void go();
    const t = setInterval(go, 20_000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, [coin]);
  if (err) return <p className="small dim tape-empty">Holders are not available right now.</p>;
  if (!rows) return <p className="small dim tape-empty">Reading holders from the chain…</p>;
  const top10 = rows.filter((r) => !r.curve).slice(0, 10).reduce((s, r) => s + r.pct, 0);
  return (
    <div className="holders">
      <div className="holders-sum small">
        Top 10 hold <b className={`mono ${top10 > 40 ? "t-down" : top10 > 25 ? "t-warn" : "t-up"}`}>{top10.toFixed(1)}%</b>
        <span className="dim"> (bonding curve excluded)</span>
      </div>
      {rows.map((r, i) => {
        const dev = r.owner && coin.meta.creator && r.owner === coin.meta.creator;
        const you = r.owner && me && r.owner === me;
        return (
          <div key={r.account} className="holder-row">
            <span className="mono dim">{i + 1}</span>
            <a className="mono" href={`https://solscan.io/account/${r.owner ?? r.account}`} target="_blank" rel="noreferrer">
              {r.curve ? "Bonding curve" : shortAddr(r.owner ?? r.account)}
            </a>
            <span>
              {dev && <span className="chip chip-warn">DEV</span>}
              {you && <span className="chip chip-you">YOU</span>}
            </span>
            <div className="holder-bar">
              <i style={{ width: `${Math.min(100, r.pct * 2)}%` }} className={r.curve ? "curve" : ""} />
            </div>
            <span className="mono num">{r.pct.toFixed(2)}%</span>
          </div>
        );
      })}
    </div>
  );
}
