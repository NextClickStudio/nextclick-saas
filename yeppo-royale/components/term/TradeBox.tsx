"use client";

import { useState } from "react";
import { compact, pct, signed, sol } from "@/lib/format";
import { PRIORITY, type Priority } from "@/lib/jup";
import { type Coin, quoteBuy, quoteSell } from "@/lib/pump";
import type { TermSettings } from "./settings";

export const BUY_KEYS = ["q", "w", "e", "r"];
export const SELL_KEYS = ["a", "s", "d", "f"];
const SLIPS = [5, 10, 15, 25, 40];

/** buy / sell box: instant presets, a custom amount, slippage and priority settings */
export default function TradeBox({
  mode,
  coin,
  cash,
  held,
  cost,
  canTrade,
  locked,
  busy,
  settings,
  set,
  onTrade,
}: {
  mode: "paper" | "real";
  coin: Coin | null;
  cash: number | null;
  held: number;
  cost: number;
  canTrade: boolean;
  locked?: string | null;
  busy: string | null;
  settings: TermSettings;
  set: (p: Partial<TermSettings>) => void;
  onTrade: (side: "buy" | "sell", amount: number, el?: Element | null) => void;
}) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amt, setAmt] = useState("");
  const [edit, setEdit] = useState(false);
  const [gear, setGear] = useState(false);
  const v = Math.max(0, parseFloat(amt.replace(",", ".")) || 0);
  const ok = canTrade && !busy && !!coin && !coin.graduated;
  const price = coin?.price() ?? 0;
  const value = held * price * 0.99;
  const pnl = value - cost;
  const qb = coin && side === "buy" && v > 0 && coin.vtok > 0 ? quoteBuy(coin.vsol, coin.vtok, v) : null;
  const sellTok = side === "sell" ? (v >= 100 ? held : (held * Math.min(v, 100)) / 100) : 0;
  const qs = coin && side === "sell" && sellTok > 0 && coin.vtok > 0 ? quoteSell(coin.vsol, coin.vtok, sellTok) : null;
  const sym = coin?.sym ?? "—";
  const presets = side === "buy" ? settings.buy : settings.sell;

  const fire = (s: "buy" | "sell", x: number, el?: Element | null) => {
    if (!ok) return;
    if (s === "buy") onTrade("buy", x, el);
    else if (held > 0) onTrade("sell", x >= 100 ? held : (held * x) / 100, el);
  };

  return (
    <div className={`tbox ${side}`}>
      <div className="tbox-tabs">
        <button className={side === "buy" ? "on buy" : ""} onClick={() => setSide("buy")}>
          Buy
        </button>
        <button className={side === "sell" ? "on sell" : ""} onClick={() => setSide("sell")}>
          Sell
        </button>
        <button className={`gear ${gear ? "on" : ""}`} aria-label="Trade settings" onClick={() => setGear(!gear)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </button>
      </div>

      {gear && (
        <div className="tbox-gear">
          <span className="lbl">Slippage</span>
          <div className="seg sm">
            {SLIPS.map((s) => (
              <button key={s} className={settings.slip === s ? "on" : ""} onClick={() => set({ slip: s })}>
                {s}%
              </button>
            ))}
          </div>
          {mode === "real" && (
            <>
              <span className="lbl">Priority fee</span>
              <div className="seg sm">
                {(Object.keys(PRIORITY) as Priority[]).map((p) => (
                  <button key={p} className={settings.prio === p ? "on" : ""} onClick={() => set({ prio: p })} title={`up to ${PRIORITY[p].max / 1e9} SOL`}>
                    {PRIORITY[p].label}
                  </button>
                ))}
              </div>
            </>
          )}
          <span className="small dim">
            {mode === "real"
              ? "Routed by Jupiter straight to the pump.fun curve. yeppo adds no fee."
              : "Fills on the coin's real bonding curve, read from the chain when you click. 1% pump.fun fee."}
          </span>
        </div>
      )}

      <div className="tbox-presets">
        {presets.map((p, i) =>
          edit ? (
            <input
              key={i}
              className="input mono preset-edit"
              defaultValue={p}
              inputMode="decimal"
              onBlur={(e) => {
                const x = parseFloat(e.target.value.replace(",", "."));
                if (!(x > 0)) return;
                const next = [...presets];
                next[i] = side === "sell" ? Math.min(100, Math.round(x)) : Math.round(x * 1000) / 1000;
                set(side === "buy" ? { buy: next } : { sell: next });
              }}
            />
          ) : (
            <button
              key={i}
              data-hk={(side === "buy" ? BUY_KEYS : SELL_KEYS)[i]}
              className={`preset ${side}`}
              disabled={!ok || (side === "buy" ? cash != null && p > cash + 1e-9 : held <= 0)}
              onClick={(e) => fire(side, p, e.currentTarget)}
            >
              <b className="mono">{side === "buy" ? p : `${p}%`}</b>
              <kbd>{(side === "buy" ? BUY_KEYS : SELL_KEYS)[i].toUpperCase()}</kbd>
            </button>
          ),
        )}
        <button className={`preset-pen ${edit ? "on" : ""}`} aria-label="Edit presets" onClick={() => setEdit(!edit)}>
          {edit ? "✓" : "✎"}
        </button>
      </div>

      <div className="tbox-amt">
        <input
          className="input mono"
          inputMode="decimal"
          placeholder={side === "buy" ? "Amount in SOL" : "Percent of your bag"}
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && v > 0 && fire(side, v, e.currentTarget)}
        />
        <span className="unit mono">{side === "buy" ? "SOL" : "%"}</span>
      </div>
      <div className="tbox-quote mono small">
        {side === "buy" ? (
          qb ? (
            <>
              <span>
                ≈ {compact(qb.tok)} {sym}
              </span>
              <span className={qb.impact > 8 ? "t-warn" : "dim"}>impact {qb.impact.toFixed(1)}%</span>
            </>
          ) : (
            <span className="dim">Pick a preset or type an amount</span>
          )
        ) : qs ? (
          <>
            <span>≈ {sol(qs.sol, 3)} SOL</span>
            <span className={qs.impact > 8 ? "t-warn" : "dim"}>impact {qs.impact.toFixed(1)}%</span>
          </>
        ) : (
          <span className="dim">{held > 0 ? "Pick how much of the bag to sell" : `No ${sym} in your bag`}</span>
        )}
      </div>

      <button
        className={`tbox-go ${side}`}
        disabled={!ok || !(v > 0) || (side === "sell" && held <= 0) || (side === "buy" && cash != null && v > cash + 1e-9)}
        onClick={(e) => fire(side, v, e.currentTarget)}
      >
        {busy ? busy : locked ? locked : side === "buy" ? `Buy ${v > 0 ? `${v} SOL` : ""} ${sym}` : `Sell ${v > 0 ? `${Math.min(v, 100)}%` : ""} ${sym}`}
      </button>

      <div className="tbox-foot">
        <div>
          <span className="lbl">{mode === "real" ? "Wallet" : "Cash"}</span>
          <b className="mono">{cash == null ? "—" : `${sol(cash, 3)} SOL`}</b>
        </div>
        <div>
          <span className="lbl">Bag</span>
          <b className="mono">{held > 0 ? `${compact(held)} · ${sol(value, 3)}` : "—"}</b>
        </div>
        <div>
          <span className="lbl">PnL</span>
          <b className={`mono ${held > 0 || cost > 0 ? (pnl >= 0 ? "t-up" : "t-down") : ""}`}>
            {held > 0 ? `${signed(pnl, 3)} ${cost > 0 ? `(${pct((pnl / cost) * 100, 0)})` : ""}` : "—"}
          </b>
        </div>
      </div>
      <div className="tbox-slip small dim mono">
        slippage {settings.slip}% {mode === "real" ? `· ${PRIORITY[settings.prio].label}` : "· real curve"}
        {mode === "real" && <span> · your wallet asks to approve</span>}
      </div>
    </div>
  );
}
