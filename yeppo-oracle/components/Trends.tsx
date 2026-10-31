"use client";

// The meme waves of the moment: the words pump.fun is launching far more often than usual in the last 30 minutes,
// and in each wave the coins already trading best, with yeppo's quick flags. Refreshes every minute.
import { useEffect, useState } from "react";
import type { Smart, Trend } from "@/app/api/trends/route";
import { age, short } from "@/lib/format";
import { useNow, usePoll } from "@/lib/hooks";
import { savedKey } from "@/lib/pay";
import { deviceId } from "./CoinPanel";

type Answer = { at: number; trends: Trend[]; smart?: Smart | null } | { locked: true; why: string };

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
      <SmartMoney s={data.smart ?? null} now={now} compact={compact} />
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
              {t.coins.map(([mint, sym, t0, , nowX, hiX, buys2, wallets2, ch2, bun, outS, copy, moved, dex], i) => (
                <a
                  key={mint}
                  className={`tr-coin ${i === 0 && !copy ? "lead" : ""} ${copy ? "copy" : ""}`}
                  href={compact ? `https://pump.fun/coin/${mint}` : `/c/${mint}`}
                  target={compact ? "_blank" : undefined}
                  rel="noreferrer"
                >
                  <span className="tr-sym">
                    {sym ? `$${sym}` : short(mint)}
                    <span className="when">{age(now - t0)}</span>
                  </span>
                  <span className="mono mute">{moved ? `${dex?.b5 ?? 0} buys · 5m` : `${wallets2} buyers · 2m`}</span>
                  <span className="mono">
                    {x(nowX)} <span className="dim">high {x(hiX)}</span>
                  </span>
                  <span className="tr-flags">
                    {i === 0 && !copy && <span className="chip tone t-up">Leader</span>}
                    {copy && <span className="chip tone t-mid">Copy</span>}
                    {moved && <span className="chip tone t-learn">Graduated</span>}
                    {moved ? (
                      <span className={`chip tone ${(dex?.ch5 ?? 0) >= 0 ? "t-up" : "t-mid"}`}>
                        {(dex?.ch5 ?? 0) >= 0 ? "+" : ""}
                        {Math.round(dex?.ch5 ?? 0)}% in 5 min
                      </span>
                    ) : (
                      <>
                        <span className={`chip tone ${(ch2 ?? 0) >= 0 ? "t-up" : "t-mid"}`}>
                          {(ch2 ?? 0) >= 0 ? "+" : ""}
                          {Math.round((ch2 ?? 0) * 100)}% in 2 min
                        </span>
                        <span className="chip tone t-learn">{buys2} buys</span>
                      </>
                    )}
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

const pct = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`;

/** coins that several wallets with a record of getting into runners early are buying right now */
function SmartMoney({ s, now, compact }: { s: Smart | null; now: number; compact?: boolean }) {
  if (!s) return null;
  return (
    <>
      <header className="tr-head">
        <h3>Smart money</h3>
        <span className="mute small">
          Wallets that keep getting into coins early before they run ×4 and more, buying the same new coin now. Only coins
          under 30 minutes old that pass yeppo&apos;s checks.
        </span>
      </header>
      {s.smart.length === 0 ? (
        <p className="mute small">
          {s.wallets >= 10
            ? `No coin is being bought by 2+ of the ${s.wallets} proven wallets right now. yeppo checks every minute.`
            : `yeppo is learning which wallets are right: ${s.wallets} proven so far, ${s.learning} being watched. Calls start once enough of them have a record (3+ wins from 3+ creators, out of 8+ early entries, 12%+ hit rate).`}
        </p>
      ) : (
        <div className="tr-coins" style={{ marginBottom: 18 }}>
          {s.smart.map((c) => (
            <a
              key={c.mint}
              className="tr-coin lead"
              href={compact ? `https://pump.fun/coin/${c.mint}` : `/c/${c.mint}`}
              target={compact ? "_blank" : undefined}
              rel="noreferrer"
            >
              <span className="tr-sym">
                {c.sym ? `$${c.sym}` : short(c.mint)}
                <span className="when">{age(now - c.t0)}</span>
              </span>
              <span className="mono mute">
                {c.smart} smart wallet{c.smart === 1 ? "" : "s"} in
                {c.out > 0 ? ` · ${c.out} took profit` : ""}
              </span>
              <span className="mono">
                {x(c.nowx)} <span className="dim">high {x(c.hix)}</span>
              </span>
              <span className="tr-flags">
                <span className="chip tone t-up">Best hit {Math.round(c.hit * 100)}%</span>
                <span className={`chip tone ${(c.ch2 ?? 0) >= 0 ? "t-up" : "t-mid"}`}>{pct(c.ch2 ?? 0)} in 2 min</span>
                <span className="chip tone t-learn">{c.wal2} buyers · 2m</span>
                {c.grad && <span className="chip tone t-learn">Graduated</span>}
                {(c.bun ?? 0) >= 0.05 && <span className="chip tone t-mid">Bundle {Math.round((c.bun ?? 0) * 100)}%</span>}
              </span>
              <span className="dim small mono" style={{ gridColumn: "1 / -1" }}>
                {c.who.slice(0, 3).map(([w, wins, hit]) => `${w} ${wins} wins ${Math.round(hit * 100)}%`).join(" · ")}
              </span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
