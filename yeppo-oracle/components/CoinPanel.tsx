"use client";

// The read of one coin: the call, the moment, the creator's history laid over this coin, and the safety
// checks. The same component fills the extension's panel and the coin page; it refreshes every 5 seconds.
import { useEffect, useState } from "react";
import type { Fate } from "@/lib/decide";
import { mins } from "@/lib/decide";
import { age, ago, mult, short, usd } from "@/lib/format";
import { useNow, usePoll } from "@/lib/hooks";
import { paperBuy, paperSell, paperState, type PaperState } from "@/lib/paper";
import { readCoin, type Read } from "@/lib/read";
import { readLocal } from "@/lib/supabase";
import { CoinImg } from "./Bits";
import Overlay from "./Overlay";

const FATE: Record<Fate, string> = { rug: "Rugged", dead: "Died", ran: "Ran", grad: "Graduated" };
const x = (v: number) => `×${v >= 10 ? v.toFixed(0) : v.toFixed(1)}`;
const sign = (v: number | null) => (v == null ? "–" : `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`);

/** paper: the owner's paper wallet, handed over by the extension (its frame cannot read yeppo.it's storage) */
export default function CoinPanel({ mint, compact, paper }: { mint: string; compact?: boolean; paper?: string | null }) {
  const { data: r, error } = usePoll<Read>(() => readCoin(mint), 5000, mint);
  const now = useNow(1000);
  if (!r)
    return (
      <div className="cp">
        {error ? (
          <div className="cp-empty">
            <b>Retrying…</b>
            yeppo is busy. It tries again every 5 seconds.
          </div>
        ) : (
          <>
            <div className="skel" style={{ height: 40 }} />
            <div className="skel" style={{ height: 82 }} />
            <div className="skel" style={{ height: 52 }} />
            <div className="skel" style={{ height: 190 }} />
          </>
        )}
      </div>
    );

  const d = r.decision;
  const p = r.pulse;
  const c = r.creator;
  const bad = r.checks.filter((k) => !k.ok).length;
  return (
    <div className="cp">
      <div className="cp-head">
        <CoinImg uri={r.uri} src={r.image} symbol={r.symbol} size={36} />
        <div>
          <b>{r.symbol ? `$${r.symbol.replace(/^\$/, "")}` : short(mint)}</b>
          <span className="sub">
            {r.venue}
            {r.t0 ? ` · ${age(now - r.t0)}` : ""}
          </span>
        </div>
        <div className="cp-mc">
          <b className="mono">{usd(r.mcUsd)}</b>
          <span className="sub">{r.priceX != null ? `${x(r.priceX)} from launch` : "market cap"}</span>
        </div>
      </div>

      <section className={`cp-call t-${d.tone}`}>
        <div key={d.word} className="cp-word cp-word-in">
          <i />
          {d.word}
        </div>
        <p>{d.why}</p>
      </section>

      {p && (
        <div className="cp-stats">
          <div className="cp-stat">
            <span>{p.ch1m != null ? "1 min" : "5 min"}</span>
            <b className={`mono ${(p.ch1m ?? p.ch5m ?? 0) >= 0 ? "up" : "down"}`}>{sign(p.ch1m ?? p.ch5m)}</b>
          </div>
          <div className="cp-stat">
            <span>buys / sells</span>
            <b className="mono">
              <span className="up">{p.buys1m}</span>
              <span className="dim"> / </span>
              <span className="down">{p.sells1m}</span>
            </b>
          </div>
          <div className="cp-stat">
            <span>{p.wallets1m != null ? "wallets" : "liquidity"}</span>
            <b className="mono">{p.wallets1m != null ? p.wallets1m : usd(r.liqUsd)}</b>
          </div>
          <div className="cp-stat">
            <span>vol 1 min</span>
            <b className="mono">{usd(p.vol1mUsd)}</b>
          </div>
        </div>
      )}

      <section className="cp-box">
        <header>
          <h3>vs. the creator&apos;s coins</h3>
          <span className="grow" />
          {c && (
            <a className="cp-dev mono" href={`https://solscan.io/account/${c.dev}`} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>
              {short(c.dev)} ↗
            </a>
          )}
        </header>
        <Overlay me={r.path} ghosts={c?.coins ?? []} sellS={c?.sellS ?? null} sellX={c?.sellX ?? null} />
      </section>

      <section className="cp-box">
        <header>
          <h3>Creator</h3>
          <span className="grow" />
          <span>{c ? `${c.total} coin${c.total === 1 ? "" : "s"} · 14 days` : ""}</span>
        </header>
        {!c ? (
          <p className="cp-line mute">Creator unknown for this coin.</p>
        ) : (
          <>
            <p className="cp-line">{c.line}</p>
            {r.dev && (
              <p className="cp-line mute" style={{ fontSize: 12 }}>
                {r.dev.out
                  ? `On this coin: sold everything${r.dev.soldS != null ? ` after ${mins(r.dev.soldS)}` : ""}.`
                  : r.dev.sold
                    ? `On this coin: started selling${r.dev.soldX ? ` at ${x(r.dev.soldX)}` : ""}.`
                    : r.dev.bought
                      ? "On this coin: still holding."
                      : "On this coin: didn't buy."}
              </p>
            )}
            {c.coins.length > 0 && (
              <div className="cp-coins">
                {c.coins.map((k) => (
                  <a key={k.mint} className="cp-coin" href={`/c/${k.mint}`} target={compact ? "_blank" : undefined} rel="noreferrer">
                    <span>
                      {k.sym ? `$${k.sym}` : short(k.mint)} <span className="when">{ago(now - k.t0)}</span>
                    </span>
                    <span className="mono mute">{x(k.peak)}</span>
                    <span className="mono dim">{k.soldS != null ? `sold ${mins(k.soldS)}` : ""}</span>
                    <span className={`chip tone fate fate-${k.fate}`}>{FATE[k.fate]}</span>
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="cp-box">
        <header>
          <h3>Safety</h3>
          <span className="grow" />
          <span className={`cp-safe ${bad ? "down" : "up"}`}>{r.checks.length ? (bad ? `${bad} problem${bad > 1 ? "s" : ""}` : `${r.checks.length}/${r.checks.length} safe`) : "loading…"}</span>
        </header>
        <div className="cp-checks">
          {[...r.checks]
            .sort((a, b) => Number(a.ok) - Number(b.ok))
            .map((k, i) => (
              <div key={k.label} className={`cp-check ${k.ok ? "" : "bad"}`} style={{ "--i": i } as React.CSSProperties}>
                <i>{k.ok ? "✓" : "✕"}</i>
                {k.label}
              </div>
            ))}
          {r.holders != null && <div className="cp-check dim" style={{ "--i": r.checks.length } as React.CSSProperties}>{r.holders.toLocaleString("en-US")} holders</div>}
        </div>
      </section>

      <PaperBox mint={mint} given={paper ?? null} />

      <div className="cp-foot">
        <span>Short-term read. Not advice.</span>
        {compact ? (
          <a href={`https://yeppo.it/c/${mint}`} target="_blank" rel="noreferrer">
            Open on yeppo ↗
          </a>
        ) : (
          r.url && (
            <a href={r.url} target="_blank" rel="noreferrer">
              DexScreener ↗
            </a>
          )
        )}
      </div>
    </div>
  );
}

/** the owner's paper trading, only where the lab key and paper wallet are saved */
function PaperBox({ mint, given }: { mint: string; given: string | null }) {
  const [acct, setAcct] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (given) setAcct(given);
    else if (readLocal<string | null>("yo:lab", null)) setAcct(readLocal<string | null>("yo:paper", null));
  }, [given]);
  const { data: st, reload } = usePoll<PaperState>(acct ? () => paperState(acct) : null, 3000, acct ?? "");
  useEffect(() => setMsg(null), [mint]);
  if (!acct) return null;
  const pos = st?.positions.find((q) => q[0] === mint);
  const run = async (what: string, f: () => Promise<unknown>, done: string) => {
    if (busy) return;
    setBusy(what);
    setMsg(null);
    try {
      await f();
      setMsg({ ok: true, text: done });
      reload();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong" });
    }
    setBusy(null);
  };
  return (
    <section className="cp-box">
      <header>
        <h3>Paper trade</h3>
        <span className="grow" />
        <span>{st ? `${st.sol.toFixed(2)} SOL` : "…"}</span>
      </header>
      {pos ? (
        <>
          <p className="cp-line">
            In {pos[3].toFixed(2)} SOL · <b className={`mono ${pos[7] >= 0 ? "up" : "down"}`}>{mult(pos[3] > 0 ? pos[6] / pos[3] : 1)}</b>
          </p>
          <div className="pp-row">
            {[0.5, 1].map((f) => (
              <button key={f} className="btn btn-sm" disabled={!!busy} onClick={() => void run(`s${f}`, () => paperSell(acct, mint, f), "Sold ✓")}>
                {busy === `s${f}` ? "Selling…" : `Sell ${f * 100}%`}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="pp-row">
          {[0.1, 0.25, 0.5].map((v) => (
            <button key={v} className="btn btn-sm btn-go" disabled={!!busy} onClick={() => void run(`b${v}`, () => paperBuy(acct, mint, v, null), "Bought ✓")}>
              {busy === `b${v}` ? "Buying…" : `Buy ${v}`}
            </button>
          ))}
        </div>
      )}
      {msg && <p className={`pp-msg ${msg.ok ? "up" : "down"}`}>{msg.text}</p>}
    </section>
  );
}
