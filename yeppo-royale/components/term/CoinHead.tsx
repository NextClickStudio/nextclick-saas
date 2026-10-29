"use client";

import { useMemo } from "react";
import { age, pct, usd } from "@/lib/format";
import { type Coin, shortAddr, solPrice } from "@/lib/pump";
import { toast } from "@/lib/fx";
import CoinAvatar from "./CoinAvatar";
import { tinyUsd } from "./TermChart";
import { TF_MS, type Tf } from "./settings";

export const platformLinks = (mint: string) => [
  { id: "pump", name: "pump.fun", url: `https://pump.fun/coin/${mint}` },
  { id: "gmgn", name: "GMGN", url: `https://gmgn.ai/sol/token/${mint}` },
  { id: "dex", name: "DexScreener", url: `https://dexscreener.com/solana/${mint}` },
  { id: "solscan", name: "Solscan", url: `https://solscan.io/token/${mint}` },
];

/** name, contract, market numbers and chart controls of the selected coin */
export default function CoinHead({
  coin,
  version,
  now,
  tf,
  unit,
  onTf,
  onUnit,
}: {
  coin: Coin;
  version: number;
  now: number;
  tf: Tf;
  unit: "mc" | "price";
  onTf: (t: Tf) => void;
  onUnit: (u: "mc" | "price") => void;
}) {
  const su = solPrice();
  const s = useMemo(() => coin.stats(now), [coin, version, Math.floor(now / 2000)]); // eslint-disable-line react-hooks/exhaustive-deps
  const created = coin.meta.created ?? coin.trades[0]?.t ?? null;
  const prog = coin.progress();
  return (
    <div className="thead">
      <div className="thead-id">
        <CoinAvatar mint={coin.mint} uri={coin.meta.uri} sym={coin.sym} size={42} lazy={false} />
        <div style={{ minWidth: 0 }}>
          <div className="thead-name">
            <h2>{coin.meta.name || coin.sym}</h2>
            <span className="mono dim">${coin.sym}</span>
          </div>
          <div className="thead-sub">
            <button
              className="ca mono"
              title="Copy the contract address"
              onClick={() => navigator.clipboard?.writeText(coin.mint).then(() => toast("Contract address copied", "info"))}
            >
              {shortAddr(coin.mint)} ⧉
            </button>
            {created && <span className="mono dim">{age(now - created).replace(/ \d+s$/, "")}</span>}
            {coin.meta.x && (
              <a className="soc" href={coin.meta.x} target="_blank" rel="noreferrer">
                𝕏
              </a>
            )}
            {coin.meta.tg && (
              <a className="soc" href={coin.meta.tg} target="_blank" rel="noreferrer">
                tg
              </a>
            )}
            {coin.meta.web && (
              <a className="soc" href={coin.meta.web} target="_blank" rel="noreferrer">
                www
              </a>
            )}
            {coin.graduated && <span className="chip chip-warn">Graduated</span>}
          </div>
        </div>
      </div>
      <div className="thead-stats">
        <div>
          <span className="lbl">Market cap</span>
          <b className={`mono t-${s.chg > 0.05 ? "up" : s.chg < -0.05 ? "down" : "flat"}`}>{coin.vtok > 0 ? usd(coin.mc() * su) : "—"}</b>
          <span className={`mono small ${s.chg >= 0 ? "t-up" : "t-down"}`}>{pct(s.chg, 1)} 5m</span>
        </div>
        <div>
          <span className="lbl">Price</span>
          <b className="mono">{coin.vtok > 0 ? tinyUsd(coin.price() * su) : "—"}</b>
          <span className="mono small dim">ATH {usd(coin.ath * su)}</span>
        </div>
        <div>
          <span className="lbl">5m vol</span>
          <b className="mono">{usd(s.vol * su)}</b>
          <span className="mono small">
            <span className="t-up">{s.buys}</span> <span className="dim">/</span> <span className="t-down">{s.sells}</span>
          </span>
        </div>
        <div className="thead-prog">
          <span className="lbl">Bonding curve</span>
          <b className="mono">{prog.toFixed(1)}%</b>
          <div className="progress">
            <i style={{ width: `${prog}%` }} />
          </div>
        </div>
      </div>
      <div className="thead-tools">
        <div className="seg sm">
          {(Object.keys(TF_MS) as Tf[]).map((t) => (
            <button key={t} className={tf === t ? "on" : ""} onClick={() => onTf(t)}>
              {t}
            </button>
          ))}
        </div>
        <div className="seg sm">
          <button className={unit === "mc" ? "on" : ""} onClick={() => onUnit("mc")}>
            MC
          </button>
          <button className={unit === "price" ? "on" : ""} onClick={() => onUnit("price")}>
            Price
          </button>
        </div>
        <div className="ext">
          {platformLinks(coin.mint).map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="ext-link">
              {p.name} ↗
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
