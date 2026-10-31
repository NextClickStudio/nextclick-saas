"use client";

// The meme waves of the moment: the words pump.fun is launching far more often than usual in the last 30 minutes,
// and in each wave the coins already trading best, with yeppo's quick flags. Refreshes every minute.
import { useEffect, useState } from "react";
import type { Trend } from "@/app/api/trends/route";
import { age, short } from "@/lib/format";
import { useNow, usePoll } from "@/lib/hooks";
import { savedKey } from "@/lib/pay";
import { deviceId } from "./CoinPanel";

type Answer = { at: number; trends: Trend[] } | { locked: true; why: string };

const x = (v: number | null) => (v == null ? "–" : `×${v >= 10 ? v.toFixed(0) : v.toFixed(1)}`);

export default function Trends({ compact, pkey, pdev }: { compact?: boolean; pkey?: string | null; pdev?: string | null }) {
  const [id, setId] = useState<{ key: string | null; dev: string } | null>(null);
  useEffect(() => setId({ key: pkey ?? savedKey(), dev: pdev ?? deviceId() }), [pkey, pdev]);
  const { data, error } = usePoll<Answer>(
    id
      ? async () => {
          const q = new URLSearchParams();
          if (id.key) q.set("key", id.key);
          q.set("dev", id.dev);
          const r = await fetch(`/api/trends?${q}`, { signal: AbortSignal.timeout(15_000) });
          const j = (await r.json()) as Answer & { error?: string };
          if (!r.ok || j.error) throw new Error(j.error ?? "yeppo is busy");
          return j;
        }
      : null,
    45_000,
    id ? `${id.key ?? "-"}` : "?",
  );
  const now = useNow(5000);
  if (!data)
    return (
      <div className="tr">
        {error ? <p className="mute small">yeppo is busy. Trying again in a minute.</p> : <div className="skel" style={{ height: 220 }} />}
      </div>
    );
  if ("locked" in data)
    return (
      <div className="tr">
        <p className="cp-line">{data.why}</p>
        <a className="btn btn-sm btn-go" href="https://yeppo.it/pricing" target="_blank" rel="noreferrer">
          Get a Pro key ↗
        </a>
      </div>
    );
  return (
    <div className="tr">
      <header className="tr-head">
        <h3>Meme waves</h3>
        <span className="mute small">Memes pump.fun is launching far more than usual, and their coins under 15 minutes old that are safe and climbing now</span>
      </header>
      {data.trends.length === 0 && <p className="mute small">No wave right now. yeppo checks every minute.</p>}
      {data.trends.map((t) => (
        <section key={t.theme} className="cp-box tr-wave">
          <header>
            <h3 className="tr-theme">{t.theme}</h3>
            <span className="grow" />
            <span className="chip tone t-up">
              {t.n30} launches in 30 min · ×{Math.round(t.burst)} usual
            </span>
          </header>
          {t.coins.length === 0 ? (
            <p className="mute small" style={{ margin: 0 }}>
              No coin of this wave is safe and climbing right now.
            </p>
          ) : (
            <div className="tr-coins">
              {t.coins.map(([mint, sym, t0, , nowX, hiX, buys2, wallets2, ch2, bun, outS], i) => (
                <a
                  key={mint}
                  className={`tr-coin ${i === 0 ? "lead" : ""}`}
                  href={compact ? `https://pump.fun/coin/${mint}` : `/c/${mint}`}
                  target={compact ? "_blank" : undefined}
                  rel="noreferrer"
                >
                  <span className="tr-sym">
                    {sym ? `$${sym}` : short(mint)}
                    <span className="when">{age(now - t0)}</span>
                  </span>
                  <span className="mono mute">{wallets2} buyers · 2m</span>
                  <span className="mono">
                    {x(nowX)} <span className="dim">high {x(hiX)}</span>
                  </span>
                  <span className="tr-flags">
                    <span className={`chip tone ${(ch2 ?? 0) >= 0 ? "t-up" : "t-mid"}`}>
                      {(ch2 ?? 0) >= 0 ? "+" : ""}
                      {Math.round((ch2 ?? 0) * 100)}% in 2 min
                    </span>
                    <span className="chip tone t-learn">{buys2} buys</span>
                    {(bun ?? 0) >= 0.05 && <span className="chip tone t-mid">Bundle {Math.round((bun ?? 0) * 100)}%</span>}
                    {outS != null && <span className="chip tone t-learn">Dev out</span>}
                  </span>
                </a>
              ))}
            </div>
          )}
        </section>
      ))}
      <p className="dim small" style={{ marginTop: 8 }}>
        A wave is not a buy signal: open a coin for yeppo&apos;s full read before you trade.
      </p>
    </div>
  );
}
