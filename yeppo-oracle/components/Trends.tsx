"use client";

// The meme waves of the moment: the words pump.fun is launching far more often than usual in the last 30 minutes,
// and in each wave the coins already trading best, with yeppo's quick flags. Refreshes every minute.
import { useEffect, useState } from "react";
import type { Smart, Trend } from "@/app/api/trends/route";
import type { WaveCoin } from "@/app/api/wave/route";
import { age, short, usd } from "@/lib/format";
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
        <span className="mute small">Memes pump.fun is launching far more than usual right now. Open one to see every coin with that name, live.</span>
      </header>
      {data.trends.length === 0 && <p className="mute small">No wave right now. yeppo checks every minute.</p>}
      {data.trends.map((t) => (
        <Wave key={t.theme} t={t} now={now} compact={compact} id={id!} />
      ))}
      <p className="dim small" style={{ marginTop: 8 }}>
        A wave is not a buy signal: open a coin for yeppo&apos;s full read before you trade.
      </p>
    </div>
  );
}

const FLAG: Record<string, [string, string]> = {
  rug: ["Rugged", "t-down"],
  bundle: ["Bundled", "t-down"],
  devbag: ["Creator holds a bag", "t-mid"],
  dumped: ["Down 50%+ from high", "t-mid"],
  farm: ["Coin-farm creator", "t-mid"],
  creator: ["Creator's past coins went bad", "t-down"],
};

/** one wave: closed it is one line; open it lists every coin with that word in its name, live, best first */
function Wave({ t, now, compact, id }: { t: Trend; now: number; compact?: boolean; id: { key: string | null; dev: string } }) {
  const [open, setOpen] = useState(false);
  const picks = new Set(t.coins.filter((c) => !c[11]).map((c) => c[0]));
  const { data, error } = usePoll<{ coins: WaveCoin[] }>(
    open
      ? async () => {
          const q = new URLSearchParams({ theme: t.theme, dev: id.dev });
          if (id.key) q.set("key", id.key);
          const r = await fetch(`/api/wave?${q}`, { signal: AbortSignal.timeout(15_000) });
          const j = (await r.json()) as { coins?: WaveCoin[]; error?: string; why?: string };
          if (!r.ok || !j.coins) throw new Error(j.error ?? j.why ?? "yeppo is busy");
          return { coins: j.coins };
        }
      : null,
    20_000,
    open ? t.theme : "-",
  );
  const live = data?.coins.filter((c) => (c.dex ? c.dex.b5 + c.dex.s5 > 0 : now - c.last < 300_000)).length ?? 0;
  return (
    <section className={`cp-box tr-wave ${open ? "open" : ""}`}>
      <button type="button" className="tr-wave-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <h3 className="tr-theme">{t.theme}</h3>
        <span className="chip tone t-up">
          {t.n30} launches in 30 min · ×{Math.round(t.burst)} usual
        </span>
        <span className="grow" />
        <span className="tr-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="tr-list">
          {!data && !error && <div className="skel" style={{ height: 120 }} />}
          {!data && error && <p className="mute small">yeppo is busy. Trying again in 20 seconds.</p>}
          {data && data.coins.length === 0 && <p className="mute small">No coin with this name in the last 2 hours.</p>}
          {data && data.coins.length > 0 && (
            <p className="dim small" style={{ margin: "0 0 6px" }}>
              {data.coins.length} coins named “{t.theme}” in the last 2 hours, {live} trading now. Live first, biggest market cap first. Updates every 20 s.
            </p>
          )}
          {data?.coins.map((c) => {
            const isLive = c.dex ? c.dex.b5 + c.dex.s5 > 0 : now - c.last < 300_000;
            const ch = c.dex ? (c.dex.ch5 ?? 0) / 100 : c.ch2;
            const f = c.flag ? FLAG[c.flag] : null;
            return (
              <a
                key={c.mint}
                className={`tr-row ${isLive ? "" : "quiet"} ${f && f[1] === "t-down" ? "bad" : ""}`}
                href={compact ? `https://pump.fun/coin/${c.mint}` : `/c/${c.mint}`}
                target={compact ? "_blank" : undefined}
                rel="noreferrer"
              >
                <span className="tr-sym">
                  {c.sym ? `$${c.sym}` : short(c.mint)}
                  <span className="when">{age(now - c.t0)}</span>
                </span>
                <span className="mono tr-mc">{c.mcUsd != null ? usd(c.mcUsd) : "–"}</span>
                <span className="mono mute tr-act">
                  {c.dex ? `${c.dex.b5}/${c.dex.s5} · 5m` : isLive ? `${c.w2} buyers · 2m` : "no trades now"}
                </span>
                <span className={`mono tr-ch ${ch == null ? "mute" : ch >= 0 ? "up" : "down"}`}>{ch == null ? "–" : pct(ch)}</span>
                <span className="tr-meta">
                  <span className="dim tr-name">{c.name ?? ""}</span>
                  <span className="mono dim">high {x(c.hix)}</span>
                  {picks.has(c.mint) && <span className="chip tone t-up">yeppo pick</span>}
                  {f && <span className={`chip tone ${f[1]}`}>{f[0]}</span>}
                  {!f && c.bun >= 0.05 && <span className="chip tone t-mid">Bundle {Math.round(c.bun * 100)}%</span>}
                  {c.out != null && <span className="chip tone t-learn">Dev out</span>}
                  {c.grad && <span className="chip tone t-learn">Graduated</span>}
                </span>
              </a>
            );
          })}
        </div>
      )}
    </section>
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
          under 30 minutes old that pass yeppo&apos;s checks. Tracking {s.learning.toLocaleString("en-US")} wallets, {s.wallets} proven.
          {s.record && s.record.calls > 0
            ? ` Past calls: ${s.record.calls}, median best within an hour ${pct(s.record.median)}, ${s.record.up50} did +50% or more.`
            : ""}
        </span>
      </header>
      {s.smart.length === 0 ? (
        <p className="mute small">
          {s.wallets >= 10
            ? `No coin is being bought by 2+ of the ${s.wallets} proven wallets right now. yeppo checks every minute.`
            : `yeppo is learning which wallets are right: ${s.wallets} proven so far, ${s.learning} being watched. Calls start once enough of them have a record (3+ wins from 3+ creators, out of 8+ early entries, 12%+ hit rate, holding a minute or more: no sniper bots).`}
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
      {s.near && s.near.length > 0 && (
        <div className="tr-near">
          <p className="dim small" style={{ margin: "0 0 4px" }}>
            Also bought by proven wallets in the last 10 minutes, but yeppo held back:
          </p>
          {s.near.map((c) => (
            <a
              key={c.mint}
              className="tr-row quiet"
              href={compact ? `https://pump.fun/coin/${c.mint}` : `/c/${c.mint}`}
              target={compact ? "_blank" : undefined}
              rel="noreferrer"
            >
              <span className="tr-sym">
                {c.sym ? `$${c.sym}` : short(c.mint)}
                <span className="when">{age(now - c.t0)}</span>
              </span>
              <span className="mono mute">
                {c.smart} proven · best {Math.round(c.hit * 100)}%
              </span>
              <span className="tr-meta">
                <span className="chip tone t-mid">{c.why}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
