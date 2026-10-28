"use client";

import { useRef, useState } from "react";
import { buyImpact, buyTokens, FEE, maxBuy, sellValue, tradeBlocked, type Coin } from "@/lib/market";
import { fmtClock, fmtNum, fmtPct, fmtSol, tone } from "@/lib/format";
import { readLocal, writeLocal } from "@/lib/supabase";
import type { Player, RoomStatus } from "@/lib/types";
import { CoinAvatar } from "../ui";

type Props = {
  coin: Coin | null;
  mint: string | null;
  me: Player | null;
  status: RoomStatus;
  busy: boolean;
  startsIn: number;
  onTrade: (side: "buy" | "sell", value: number, el: HTMLElement | null) => void;
  onJoin: () => void;
  coins: Record<string, Coin>;
  onSelect: (mint: string) => void;
};

const BUY_PRESETS = [0.1, 0.25, 0.5, 1, 2, 5];
const SELL_PRESETS = [10, 25, 50, 100];

export default function TradePanel({ coin, mint, me, status, busy, startsIn, onTrade, onJoin, coins, onSelect }: Props) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState<number>(() => readLocal("yeppo:amt", 0.5));
  const [custom, setCustom] = useState("");
  const [pct, setPct] = useState(100);
  const btn = useRef<HTMLButtonElement>(null);

  const cash = me ? +me.cash : 0;
  const pos = me && mint ? me.positions?.[mint] : undefined;
  const sym = coin?.symbol ?? "";

  const pickAmount = (v: number) => {
    setAmount(v);
    setCustom("");
    writeLocal("yeppo:amt", v);
  };

  // previews mirror the server fill math
  const tokensOut = coin && amount > 0 ? buyTokens(coin, amount) : 0;
  const impact = coin && amount > 0 ? buyImpact(coin, amount) * 100 : 0;
  const limit = coin ? maxBuy(coin) : 0;
  const sellQty = pos ? (pos.qty * pct) / 100 : 0;
  const sellOut = coin && sellQty > 0 ? sellValue(coin, sellQty) : 0;
  const sellPnl = pos ? sellOut - (pos.cost * pct) / 100 : 0;
  const posValue = coin && pos ? sellValue(coin, pos.qty) : 0;
  const posPnl = pos ? posValue - pos.cost : 0;

  let label: string;
  let disabled = busy;
  let action: () => void = () => undefined;
  if (!me) {
    label = status === "ended" ? "Arena finita" : "Entra in gara per tradare";
    disabled = status === "ended";
    action = onJoin;
  } else if (status === "upcoming") {
    label = `Si parte tra ${fmtClock(startsIn)}`;
    disabled = true;
  } else if (status === "ended") {
    label = "Arena finita";
    disabled = true;
  } else if (!coin) {
    label = mint ? "In attesa del prezzo…" : "Scegli una coin";
    disabled = true;
  } else if (side === "buy") {
    if (tradeBlocked(coin)) {
      label = "Liquidità sotto $5K · bloccata";
      disabled = true;
    } else if (!(amount > 0)) {
      label = "Scegli un importo";
      disabled = true;
    } else if (amount > cash + 1e-9) {
      label = "Saldo insufficiente";
      disabled = true;
    } else if (amount > limit + 1e-9) {
      label = `Max ${limit.toFixed(2)} SOL su questa coin`;
      disabled = true;
    } else {
      label = `BUY $${sym} · ${amount} SOL`;
      action = () => onTrade("buy", amount, btn.current);
    }
  } else if (!pos) {
    label = `Non hai $${sym}`;
    disabled = true;
  } else {
    label = `SELL ${pct}% · ${fmtSol(sellOut)} SOL`;
    action = () => onTrade("sell", pct, btn.current);
  }
  if (busy && me) label = "Eseguo…";

  const myPositions = Object.entries(me?.positions ?? {});

  return (
    <div className="dock">
      <div className="trade">
        <div className="seg">
          <button className={side === "buy" ? "on buy" : ""} onClick={() => setSide("buy")}>
            Buy
          </button>
          <button className={side === "sell" ? "on sell" : ""} onClick={() => setSide("sell")}>
            Sell
          </button>
          <span className="trade-cash mono">
            {me ? (
              <>
                Cash <b>{fmtSol(cash)}</b> SOL
              </>
            ) : (
              <span className="muted">spettatore</span>
            )}
          </span>
        </div>

        {side === "buy" ? (
          <div className="presets">
            {BUY_PRESETS.map((v) => (
              <button key={v} className={amount === v && !custom ? "on" : ""} onClick={() => pickAmount(v)}>
                {v}
              </button>
            ))}
            <input
              className="preset-input mono"
              inputMode="decimal"
              placeholder="SOL"
              value={custom}
              onChange={(e) => {
                const v = e.target.value.replace(",", ".");
                setCustom(v);
                const n = parseFloat(v);
                setAmount(isFinite(n) ? n : 0);
              }}
            />
          </div>
        ) : (
          <div className="presets">
            {SELL_PRESETS.map((v) => (
              <button key={v} className={pct === v ? "on sell" : ""} onClick={() => setPct(v)}>
                {v}%
              </button>
            ))}
          </div>
        )}

        <button
          ref={btn}
          className={`trade-btn ${side === "buy" ? "btn-buy" : "btn-sell"} ${!me && status !== "ended" ? "pulse" : ""}`}
          disabled={disabled}
          onClick={action}
        >
          {label}
        </button>

        <div className="trade-info mono">
          {coin && side === "buy" && (
            <>
              ≈ {fmtNum(tokensOut)} ${sym} · impatto {impact.toFixed(1)}% · fee {FEE * 100}%
            </>
          )}
          {coin && side === "sell" && pos && (
            <>
              PnL su questa vendita <b className={`t-${tone(sellPnl)}`}>{fmtSol(sellPnl, true)} SOL</b>
            </>
          )}
        </div>

        {pos && coin && (
          <div className="posbox">
            <div>
              <label>In mano</label>
              <b className="mono">
                {fmtNum(pos.qty)} ${sym}
              </b>
            </div>
            <div>
              <label>Valore</label>
              <b className="mono">{fmtSol(posValue)} SOL</b>
            </div>
            <div className={`posbox-pnl t-${tone(posPnl)}`}>
              <label>PnL</label>
              <b className="mono">
                {fmtSol(posPnl, true)} <small>({fmtPct(pos.cost > 0 ? (posPnl / pos.cost) * 100 : 0)})</small>
              </b>
            </div>
          </div>
        )}
      </div>

      <div className="holdings">
        <div className="panel-title">
          Le tue posizioni <span className="muted mono">{myPositions.length}</span>
        </div>
        {myPositions.length ? (
          <div className="holdings-rows">
            {myPositions.map(([m, p]) => {
              const c = coins[m];
              const v = c ? sellValue(c, p.qty) : p.cost;
              const pnl = v - p.cost;
              return (
                <button key={m} className={`hold-row ${m === mint ? "on" : ""}`} onClick={() => onSelect(m)}>
                  <CoinAvatar image={p.image} symbol={p.symbol} mint={m} size={20} />
                  <b>${p.symbol}</b>
                  <span className="mono">{fmtSol(v)}</span>
                  <span className={`mono t-${tone(pnl)}`}>{fmtPct(p.cost > 0 ? (pnl / p.cost) * 100 : 0)}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rows-empty muted">{me ? "Nessuna posizione aperta. Compra la tua prima coin 👆" : "Entra in gara per avere 10 SOL finti"}</div>
        )}
      </div>
    </div>
  );
}
