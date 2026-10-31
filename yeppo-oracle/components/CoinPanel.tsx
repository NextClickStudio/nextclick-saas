"use client";

// The read of one coin: the call, the moment, the creator's history laid over this coin, and the safety
// checks. The same component fills the extension's panel and the coin page; it refreshes every 5 seconds.
import { useEffect, useRef, useState } from "react";
import type { Fate } from "@/lib/decide";
import { mins } from "@/lib/decide";
import { age, ago, mult, short, usd } from "@/lib/format";
import { useNow, usePoll } from "@/lib/hooks";
import { paperBuy, paperOpen, paperSell, paperState, refreshPx, traceMoney, type PaperState } from "@/lib/paper";
import { type Money, readCoin, type Read } from "@/lib/read";
import { license, savedKey } from "@/lib/pay";
import { readLocal, writeLocal } from "@/lib/supabase";
import { CoinImg, Num } from "./Bits";
import Overlay from "./Overlay";

const FATE: Record<Fate, string> = { rug: "Rugged", dead: "Faded", ran: "Ran", grad: "Graduated" };
const x = (v: number) => `×${v >= 10 ? v.toFixed(0) : v.toFixed(1)}`;
const sign = (v: number | null) => (v == null ? "–" : `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`);

/** paper: the owner's paper wallet, handed over by the extension (its frame cannot read yeppo.it's storage) */
/** tell the extension this page sits in (and only the extension, never another site that frames yeppo) */
function tellExtension(msg: Record<string, unknown>) {
  const parent = window.location.ancestorOrigins?.[0] ?? (document.referrer ? new URL(document.referrer).origin : "");
  if (parent.startsWith("chrome-extension://") && window.parent !== window) window.parent.postMessage(msg, parent);
}

/** paper: the paper wallet and pkey: the Pro key, both handed over by the extension (its frame cannot read
 *  yeppo.it's storage); on yeppo.it itself both come from this browser's storage */
export default function CoinPanel({ mint, compact, paper, pkey }: { mint: string; compact?: boolean; paper?: string | null; pkey?: string | null }) {
  const [key, setKey] = useState<string | null | undefined>(pkey ?? undefined);
  useEffect(() => {
    setKey(pkey ?? savedKey());
  }, [pkey]);
  const { data: r, error } = usePoll<Read>(key === undefined ? null : () => readCoin(mint, key), 5000, `${mint}:${key ?? ""}`);
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

      {!r.pro && <ProBox onKey={setKey} />}

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

      {r.outlook && (
        <section className="cp-box">
          <header>
            <h3>Outlook</h3>
            <span className="grow" />
            <span className={`chip tone ${r.outlook.bias === "bullish" ? "t-up" : r.outlook.bias === "bearish" ? "t-down" : "t-learn"}`}>
              {r.outlook.bias === "bullish" ? "Bias up" : r.outlook.bias === "bearish" ? "Bias down" : "No trend"}
            </span>
          </header>
          <div className="cp-tf">
            {r.outlook.tf.map((t) => (
              <div key={t.k}>
                <span>{t.k}</span>
                <b className={`mono ${t.v == null ? "dim" : t.v >= 0 ? "up" : "down"}`}>{sign(t.v)}</b>
              </div>
            ))}
          </div>
          <p className="cp-line mute" style={{ margin: "8px 0 0", fontSize: 12.5 }}>
            {r.outlook.line}
          </p>
        </section>
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
          <p className="cp-line mute">{r.down?.includes("history") ? "yeppo's creator history isn't answering. Retrying every 5 seconds." : "Creator unknown for this coin."}</p>
        ) : (
          <>
            <p className="cp-line">{c.line}</p>
            {r.dev && (
              <p className="cp-line mute" style={{ fontSize: 12 }}>
                {r.dev.rugS != null
                  ? `On this coin: dumped it ${sign(-(r.dev.rugDrop ?? 0.6))} after ${mins(r.dev.rugS)}.`
                  : r.dev.out
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
                    <span className="mono mute">{k.peak >= 0.5 ? x(k.peak) : "–"}</span>
                    <span className="mono dim">
                      {k.rugS != null ? `dump ${sign(-(k.rugDrop ?? 0.6))}` : k.soldS != null ? `sold ${mins(k.soldS)}` : ""}
                    </span>
                    <span className={`chip tone fate fate-${k.fate}`}>{FATE[k.fate]}</span>
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {r.pro && <MoneyBox mint={mint} dev={c?.dev ?? null} m={r.money} devOut={!!r.dev?.out} />}

      <section className="cp-box">
        <header>
          <h3>Safety</h3>
          <span className="grow" />
          <span className={`cp-safe ${bad ? "down" : r.down?.includes("rugcheck") ? "mid" : "up"}`}>
            {bad ? `${bad} problem${bad > 1 ? "s" : ""}` : r.down?.includes("rugcheck") ? "partial" : r.checks.length ? `${r.checks.length}/${r.checks.length} safe` : "…"}
          </span>
        </header>
        {r.down?.includes("rugcheck") && (
          <p className="cp-line mute" style={{ fontSize: 12, margin: "0 0 8px" }}>
            RugCheck isn&apos;t answering, so holders and insiders can&apos;t be checked right now. Below: what the chain itself says.
          </p>
        )}
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

/** where the creator's SOL came from, and what the same money did before. Information only: the call never
 *  depends on it. Asks yr-fund to trace the wallet the first time, then shows the result on the next refresh. */
function MoneyBox({ mint, dev, m, devOut }: { mint: string; dev: string | null; m: Money | null; devOut: boolean }) {
  const [asked, setAsked] = useState<string | null>(null);
  useEffect(() => {
    if (dev && m && !m.checked && asked !== dev) {
      setAsked(dev);
      void traceMoney(dev, mint);
    }
  }, [dev, m, mint, asked]);
  if (!dev) return null;
  let tone = "t-learn";
  let head = "Tracing…";
  const lines: string[] = [];
  if (!m || !m.checked) lines.push("Following the creator's money on-chain. A few seconds.");
  else if (m.kind === "exchange") {
    head = "Exchange";
    lines.push("The creator was funded from an exchange. The trail stops there.");
  } else if (m.kind === "old") {
    head = "Old wallet";
    lines.push("Old wallet with a long history. Not traced.");
  } else if (m.kind !== "wallet") {
    head = "No trail";
    lines.push("No funding transfer found.");
  } else {
    const bad = m.rugs > 0 || m.dirty > 0 || m.family >= 2;
    tone = bad ? (devOut && m.dirty === 0 && m.family < 2 ? "t-mid" : "t-down") : m.coins > 0 ? "t-up" : "t-learn";
    head = bad ? "Suspicious" : m.coins > 0 ? "Clean so far" : "New money";
    if (m.rugs > 0) {
      lines.push(`The creator's SOL came from ${short(m.funder)}, a wallet tied to ${m.rugs} rug${m.rugs > 1 ? "s" : ""}${m.rug_syms.length ? ` (${m.rug_syms.map((x) => `$${x}`).join(", ")})` : ""}.`);
      lines.push(devOut ? "The creator already sold everything: they can't dump this one on you." : "The creator still holds: they could dump.");
    } else if (m.coins > 0) {
      lines.push(`Same money launched ${m.coins} other coin${m.coins > 1 ? "s" : ""}: ${m.ran} ran, ${m.coins - m.ran} faded, no rugs.${m.best && m.best >= 2 ? ` Best ×${m.best.toFixed(1)}.` : ""}`);
    } else lines.push(`Funded by ${short(m.funder)}${m.sol ? ` (${m.sol.toFixed(2)} SOL)` : ""}. No other coins from this money yet.`);
    if (m.family > 0) lines.push(`${m.family} early buyer${m.family > 1 ? "s were" : " was"} paid by the same money as the creator.`);
    if (m.dirty > 0) lines.push(`${m.dirty} early buyer${m.dirty > 1 ? "s are" : " is"} tied to past rugs.`);
  }
  return (
    <section className={`cp-box cp-money ${tone}`}>
      <header>
        <h3>Money trail</h3>
        <span className="grow" />
        <span className={`chip tone ${tone}`}>{head}</span>
      </header>
      {lines.map((l) => (
        <p key={l} className="cp-line" style={{ fontSize: 12.5, margin: "0 0 4px" }}>
          {l}
        </p>
      ))}
    </section>
  );
}

/** paper trading with 10 free paper SOL at real prices. The wallet id is the only key: kept in this browser, or by
 *  the extension (its frame cannot keep yeppo.it's storage, so the id comes back in the URL). */
function PaperBox({ mint, given }: { mint: string; given: string | null }) {
  const [acct, setAcct] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    setAcct(given ?? readLocal<string | null>("yo:paper", null));
  }, [given]);
  // the price of a held coin is refreshed (DexScreener, for coins past pump.fun's curve) every few polls; an
  // empty wallet only reads its balance. Light on the database: one read every 5 seconds per open panel.
  const held = useRef(false);
  const polls = useRef(0);
  const { data: st, reload } = usePoll<PaperState>(
    acct
      ? async () => {
          if (held.current && polls.current++ % 2 === 0) await refreshPx([mint]).catch(() => null);
          return paperState(acct);
        }
      : null,
    5000,
    `${acct ?? ""}:${mint}`,
  );
  useEffect(() => setMsg(null), [mint]);
  const pos = st?.positions.find((q) => q[0] === mint);
  held.current = !!pos;
  const run = async (what: string, f: () => Promise<unknown>, done: string) => {
    if (busy || !acct) return;
    setBusy(what);
    setMsg(null);
    try {
      await refreshPx([mint]);
      await f();
      setMsg({ ok: true, text: done });
      reload();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong" });
    }
    setBusy(null);
  };
  const start = async () => {
    setBusy("open");
    try {
      const id = await paperOpen();
      writeLocal("yo:paper", id);
      // the extension keeps it for its frames
      tellExtension({ yeppo: "paper", id });
      setAcct(id);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong" });
    }
    setBusy(null);
  };
  if (!acct)
    return (
      <section className="cp-box">
        <header>
          <h3>Paper trade</h3>
          <span className="grow" />
          <span>practice · real fees</span>
        </header>
        <button className="btn btn-sm btn-go" style={{ width: "100%" }} disabled={!!busy} onClick={() => void start()}>
          {busy ? "Opening…" : "Start with 10 free paper SOL"}
        </button>
        {msg && <p className={`pp-msg ${msg.ok ? "up" : "down"}`}>{msg.text}</p>}
      </section>
    );
  const value = pos ? pos[6] : 0;
  const pnl = pos && pos[3] > 0 ? pos[6] / pos[3] - 1 : 0;
  return (
    <section className="cp-box pp">
      <header>
        <h3>Paper trade</h3>
        <span className="grow" />
        <span className="mono">{st ? <Num value={st.sol} fmt={(v) => `${v.toFixed(2)} SOL`} /> : "…"}</span>
      </header>
      {pos && (
        <div className="pp-pos">
          <div>
            <span>in</span>
            <b className="mono">{pos[3].toFixed(2)}</b>
          </div>
          <div>
            <span>now</span>
            <b className="mono">
              <Num value={value} fmt={(v) => v.toFixed(3)} dur={500} />
            </b>
          </div>
          <div>
            <span>P&amp;L</span>
            <b className={`mono ${pnl >= 0 ? "up" : "down"}`}>
              <Num value={pnl * 100} fmt={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`} dur={500} />
            </b>
          </div>
        </div>
      )}
      <div className="pp-row">
        {[0.1, 0.25, 0.5, 1].map((v) => (
          <button key={v} className={`btn btn-sm btn-go pp-b ${busy === `b${v}` ? "is-busy" : ""}`} disabled={!!busy} onClick={() => void run(`b${v}`, () => paperBuy(acct, mint, v, null), pos ? `Added ${v} SOL ✓` : "Bought ✓")}>
            {busy === `b${v}` ? "…" : `${pos ? "+" : "Buy "}${v}`}
          </button>
        ))}
      </div>
      {pos && (
        <div className="pp-row" style={{ marginTop: 6 }}>
          {[0.25, 0.5, 1].map((f) => (
            <button key={f} className={`btn btn-sm pp-s ${busy === `s${f}` ? "is-busy" : ""}`} disabled={!!busy} onClick={() => void run(`s${f}`, () => paperSell(acct, mint, f), "Sold ✓")}>
              {busy === `s${f}` ? "…" : `Sell ${f * 100}%`}
            </button>
          ))}
        </div>
      )}
      {msg && (
        <p key={msg.text} className={`pp-msg cp-word-in ${msg.ok ? "up" : "down"}`}>
          {msg.text}
        </p>
      )}
      <p className="pp-msg dim" style={{ fontSize: 11 }}>
        Fees like a real trade: pump.fun 1.25% (0.3% after graduation), terminal 1%, network 0.002 SOL.
      </p>
    </section>
  );
}

/** a free read: what Pro adds, and a place for the key */
function ProBox({ onKey }: { onKey: (k: string) => void }) {
  const [open, setOpen] = useState(false);
  const [k, setK] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const check = async () => {
    const key = k.trim().toUpperCase();
    if (!key) return;
    setBusy(true);
    setErr(null);
    const l = await license(key).catch(() => null);
    setBusy(false);
    if (!l?.ok) return setErr(l ? "That key is not active." : "Can't check the key right now. Try again.");
    writeLocal("yo:key", key);
    tellExtension({ yeppo: "key", key });
    onKey(key);
  };
  return (
    <section className="cp-box cp-pro">
      <header>
        <h3>Pro</h3>
        <span className="grow" />
        <span className="chip tone t-learn">Locked</span>
      </header>
      <p className="cp-line" style={{ fontSize: 12.5, margin: "0 0 10px" }}>
        When to get in: Momentum or Wait, live. Plus the outlook on 4 timeframes and the money trail behind the creator.
      </p>
      <div className="pp-row">
        <a className="btn btn-sm btn-go" href="https://yeppo.it/pricing" target="_blank" rel="noreferrer">
          Get Pro
        </a>
        <button className="btn btn-sm" onClick={() => setOpen((o) => !o)}>
          I have a key
        </button>
      </div>
      {open && (
        <form
          className="field"
          style={{ marginTop: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            void check();
          }}
        >
          <input value={k} onChange={(e) => setK(e.target.value)} placeholder="YEP-XXXXX-XXXXX-XXXXX-XXXXX" spellCheck={false} autoFocus />
          <button className="btn btn-sm" disabled={busy}>
            {busy ? "…" : "Unlock"}
          </button>
        </form>
      )}
      {err && <p className="pp-msg down">{err}</p>}
    </section>
  );
}
