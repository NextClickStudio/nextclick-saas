"use client";

import { useEffect, useRef, useState } from "react";
import type { Coin, Launch } from "@/lib/market";
import { fmtAge, fmtPct, fmtPrice, fmtUsd, shortMint, tone } from "@/lib/format";
import { toast } from "@/lib/fx";
import { CoinAvatar, Stat } from "../ui";

type Props = { coin: Coin | null; mint: string | null; launch?: Launch; now: number };

export default function CoinHeader({ coin, mint, launch, now }: Props) {
  const prev = useRef<{ mint: string | null; mc: number }>({ mint: null, mc: 0 });
  const [flash, setFlash] = useState<{ dir: "up" | "down"; n: number } | null>(null);

  useEffect(() => {
    if (!coin) return;
    const p = prev.current;
    if (p.mint === coin.mint && p.mc && coin.mcapUsd !== p.mc) {
      setFlash((f) => ({ dir: coin.mcapUsd > p.mc ? "up" : "down", n: (f?.n ?? 0) + 1 }));
    }
    prev.current = { mint: coin.mint, mc: coin.mcapUsd };
  }, [coin]);

  if (!mint) {
    return (
      <div className="coinhead coinhead-empty">
        <span className="muted">← Scegli una coin dalla lista, oppure incolla un contract address</span>
      </div>
    );
  }

  const copy = () =>
    navigator.clipboard?.writeText(mint).then(
      () => toast("CA copiato", "info"),
      () => undefined,
    );

  if (!coin) {
    return (
      <div className="coinhead">
        <CoinAvatar symbol={launch?.symbol ?? "?"} mint={mint} size={40} />
        <div className="ch-id">
          <div className="ch-sym">
            ${launch?.symbol ?? shortMint(mint)} <span className="ch-name">{launch?.name}</span>
          </div>
          <div className="ch-links">
            <button onClick={copy}>{shortMint(mint)} ⧉</button>
          </div>
        </div>
        <div className="ch-wait">
          <i className="spinner" /> {launch ? "Appena nata: DexScreener la sta indicizzando…" : "Carico i dati live…"}
        </div>
      </div>
    );
  }

  const total = coin.buys5m + coin.sells5m;
  const buyPct = total ? (coin.buys5m / total) * 100 : 50;

  return (
    <div className="coinhead">
      <CoinAvatar image={coin.image} symbol={coin.symbol} mint={coin.mint} size={40} />
      <div className="ch-id">
        <div className="ch-sym">
          ${coin.symbol} <span className="ch-name">{coin.name}</span>
        </div>
        <div className="ch-links">
          <button onClick={copy} title="Copia contract address">
            {shortMint(coin.mint)} ⧉
          </button>
          {coin.twitter && (
            <a href={coin.twitter} target="_blank" rel="noreferrer" title="Profilo X">
              𝕏
            </a>
          )}
          <a href={coin.url} target="_blank" rel="noreferrer" title="Apri su DexScreener">
            DEX
          </a>
          {coin.website && (
            <a href={coin.website} target="_blank" rel="noreferrer" title="Sito">
              WEB
            </a>
          )}
          <span className="chip">{coin.dexId}</span>
        </div>
      </div>
      <div className="ch-mc">
        <label>Market cap</label>
        <b key={flash?.n ?? 0} className={`mono ${flash ? `flash-${flash.dir}` : ""}`}>
          {fmtUsd(coin.mcapUsd)}
        </b>
      </div>
      <div className="ch-stats">
        <Stat label="Prezzo" value={<span className="mono">{fmtPrice(coin.priceUsd)}</span>} />
        <Stat label="5m" value={<span className="mono">{fmtPct(coin.chg5m)}</span>} tone={tone(coin.chg5m)} />
        <Stat label="1h" value={<span className="mono">{fmtPct(coin.chg1h)}</span>} tone={tone(coin.chg1h)} />
        <Stat label="24h" value={<span className="mono">{fmtPct(coin.chg24h)}</span>} tone={tone(coin.chg24h)} />
        <Stat label="Liquidità" value={<span className="mono">{coin.liqUsd != null ? fmtUsd(coin.liqUsd) : "curve"}</span>} />
        <Stat label="Vol 24h" value={<span className="mono">{fmtUsd(coin.vol24)}</span>} />
        <Stat label="Età" value={<span className="mono">{coin.createdAt ? fmtAge(now - coin.createdAt) : "—"}</span>} />
      </div>
      <div className="ch-pressure" title="Acquisti vs vendite negli ultimi 5 minuti">
        <label>
          <span className="t-up">{coin.buys5m} buy</span> · <span className="t-down">{coin.sells5m} sell</span>
        </label>
        <div className="pressure-bar">
          <i style={{ width: `${buyPct}%` }} />
        </div>
      </div>
    </div>
  );
}
