"use client";

// The extension's view: the coin in front of you (verdict, exit plan, red flags, plain words) and, below,
// your wallet (Safety Net and every open bag with its alarm). Built for a 340 to 440 px wide side panel.
import { useEffect, useMemo, useState } from "react";
import { age, isMint, mult, short, usd } from "@/lib/format";
import { ALARM, DEFAULT_LIMITS, readBag, safety, type Limits } from "@/lib/guard";
import { usePoll, useNow, useSol } from "@/lib/hooks";
import { namesOf, type Names } from "@/lib/meta";
import { exitView, maxBuy, type Plan } from "@/lib/oracle";
import { plainWords } from "@/lib/plain";
import { readCoin, type Read } from "@/lib/read";
import { paperBuy, paperSell, paperState, type PaperState } from "@/lib/paper";
import { readLocal, rpc, writeLocal } from "@/lib/supabase";
import type { Guard, TickRow, Track, Xray } from "@/lib/types";
import { CoinImg } from "./Bits";

/** saves a setting here and, inside the extension, hands it to the extension too: each trading site keeps its
 *  own storage for this frame, so the extension is the one place the wallet and the limits are remembered */
function keep(key: string, value: unknown) {
  writeLocal(key, value);
  if (window.parent !== window) window.parent.postMessage({ yeppo: "keep", key, value }, "*");
}

export default function PanelView({ mint }: { mint: string | null }) {
  const [lim, setLim] = useState<Limits>(DEFAULT_LIMITS);
  const [who, setWho] = useState<string | null>(null);
  useEffect(() => {
    // the extension passes what it remembers in the address
    const q = new URLSearchParams(location.search);
    const w = q.get("who");
    const risk = Number(q.get("risk"));
    const daily = Number(q.get("daily"));
    if (w && isMint(w)) writeLocal("yo:guard", w);
    if (risk > 0 && daily > 0) writeLocal("yo:limits", { risk, daily });
    // the owner's lab: a paper wallet, shown only where the lab key is saved
    const lab = q.get("lab");
    const paper = q.get("paper");
    if (lab) writeLocal("yo:lab", lab);
    if (paper) writeLocal("yo:paper", paper);
    setLim(readLocal<Limits>("yo:limits", DEFAULT_LIMITS));
    setWho(readLocal<string | null>("yo:guard", null));
  }, []);
  const { data: track } = usePoll<Track | null>(() => rpc<Track | null>("yr_otrack"), 300_000, "track");
  const { data: g } = usePoll<Guard>(who ? () => rpc<Guard>("yr_guard", { p_who: who }) : null, 8000, who ?? "");
  const now = useNow(1000);
  const net = safety(g ?? null, lim, now);
  const outs = (g?.bags ?? []).map((b) => readBag(b, track ?? null)).filter((r) => r.alarm === "out").length;

  return (
    <div className="pv">
      <a className={`pv-net s-${net?.state ?? "none"}`} href="#wallet">
        {net ? (
          <>
            <b>{net.state === "stop" ? "⛔ Stop for today" : net.state === "slow" ? "✋ Slow down" : "🛡 Safety Net on"}</b>
            <span>
              {outs > 0 ? `${outs} bag${outs > 1 ? "s" : ""} to sell now · ` : ""}today {net.today >= 0 ? "+" : ""}
              {net.today.toFixed(2)} SOL
            </span>
          </>
        ) : (
          <>
            <b>🛡 Safety Net</b>
            <span>add your wallet below</span>
          </>
        )}
      </a>
      {mint ? (
        <CoinRead mint={mint} track={track ?? null} lim={lim} setLim={setLim} />
      ) : (
        <div className="pv-body">
          <div className="pv-empty">
            <h2>Open a coin and yeppo reads it</h2>
            <p>Go to any coin on pump.fun, GMGN, Axiom, Photon, BullX or DexScreener. yeppo spots it by itself and says OK to buy, Risky or Don&apos;t buy, and why.</p>
          </div>
        </div>
      )}
      <div id="wallet" className="pv-sep">
        <span>My wallet</span>
      </div>
      <WalletBox who={who} setWho={setWho} g={g ?? null} track={track ?? null} lim={lim} setLim={setLim} now={now} />
    </div>
  );
}

function CoinRead({ mint, track, lim, setLim }: { mint: string; track: Track | null; lim: Limits; setLim: (l: Limits) => void }) {
  const sol = useSol() || 150;
  const now = useNow(2000);
  // the answer first: one fast call, answered from the board when the coin is on it
  const { data: rd, error: rdErr } = usePoll<Read>(() => readCoin(mint), 5000, mint);
  // the last minute of trades, for the live price and "right now"
  const { data: tk } = usePoll<{ now: number; ticks: TickRow[] }>(
    () => rpc("yr_ticks", { p_mints: [mint], p_since: Date.now() - 65_000 }),
    4000,
    mint,
  );
  // the holders, for the plain words below: slower, nothing waits on it
  const { data: xr } = usePoll<Xray>(() => rpc<Xray>("yr_xray", { p_mint: mint }), 15_000, mint);
  const [named, setNamed] = useState<Names | null>(null);
  useEffect(() => {
    setNamed(null);
    if (rd && !rd.symbol) void namesOf([mint]).then((n) => n[mint] && setNamed(n[mint]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mint, !!rd]);

  const x = xr && xr.tracked ? xr : null;
  const ticks = tk?.ticks ?? [];
  const last = ticks[ticks.length - 1];
  const mc = last && last[6] > 0 ? (last[5] / last[6]) * 1e9 : (rd?.mc ?? 0);
  const minute = (() => {
    const from = (tk?.now ?? Date.now()) - 60_000;
    let buys = 0;
    let sells = 0;
    let ago: number | null = null;
    for (const t of ticks) {
      if (t[6] <= 0) continue;
      const m = (t[5] / t[6]) * 1e9;
      if (t[1] < from) ago = m;
      else {
        ago ??= m;
        if (t[2] === 1) buys++;
        else sells++;
      }
    }
    return { buys, sells, ago };
  })();
  const lastAgo = last ? Math.max(0, (tk?.now ?? now) - last[1]) : null;
  const ev = x ? exitView(x) : null;
  const soon = ev ? ev.overdue + ev.s30 + ev.s60 : 0;
  const plain = plainWords({ mcNow: mc, mcMinuteAgo: minute.ago, buys: minute.buys, sells: minute.sells, x, odds: rd?.odds ?? null, soon });
  const symbol = rd?.symbol ?? named?.symbol ?? null;
  const uri = rd?.uri ?? named?.uri ?? null;
  const d = rd?.decision ?? null;
  const p = rd?.plan ?? null;
  const buy = p ? maxBuy(lim.risk, p.stop) : 0;
  // the flags the checks do not already say
  const extra = (rd?.flags ?? []).filter((f) => !f.text.startsWith("Bot ladder") && !f.text.startsWith("Serial rugger"));
  const out = rd && !rd.tracked ? rd.outside : null;
  const where = out ? (DEX[out.dex] ?? out.dex) : null;
  const word = d?.word ?? (!rd ? (rdErr ? "Retrying…" : "Reading…") : out ? "Not checked" : !rd.tracked ? "Not followed" : rd.old ? "Too old to read" : "Too early");
  const why =
    d?.why ??
    (out
      ? out.dex === "pumpswap"
        ? "It graduated from pump.fun to PumpSwap. yeppo reads coins on the pump.fun curve, so here it can only show the market."
        : `Launched on ${where}. yeppo runs its scam checks on pump.fun coins it saw from their first trade, so here it can only show the market.`
      : !rd
      ? rdErr
        ? "yeppo is busy right now and tries again every 5 seconds."
        : "One moment."
      : !rd.tracked
        ? "yeppo reads pump.fun coins it saw from their first trade. This one launched before, or elsewhere."
        : "yeppo reads coins in their first 40 minutes, when most of the move happens.");
  const tone = d?.tone ?? "learn";

  return (
    <div className="pv-body">
      <div className="pv-coin">
        <CoinImg uri={uri} symbol={symbol} size={38} />
        <div>
          <b>{symbol ? `$${symbol.replace(/^\$/, "")}` : short(mint)}</b>
          <span>
            {rd?.t0 ? `${age(now - rd.t0)} old` : short(mint)}
            {lastAgo != null ? ` · last trade ${lastAgo < 2000 ? "now" : `${age(lastAgo)} ago`}` : ""}
          </span>
        </div>
        <div className="pv-mc">
          <b className="mono">{mc ? usd(mc * sol) : out?.mcap ? usd(out.mcap) : "–"}</b>
          <span>market cap</span>
        </div>
      </div>

      <section className={`pv-decide d-${tone}`}>
        <b>{d ? DECIDE_ICON[d.tone] : ""} {word}</b>
        <p>{why}</p>
        {rd?.verdict && <span className="pv-decide-sub">{rd.verdict.line}</span>}
      </section>

      {out && (
        <section className="pv-outside">
          <h3>The market on {where}</h3>
          <div className="pv-plan-grid">
            <div>
              <span>Liquidity</span>
              <b className={`mono ${out.liq != null && out.liq < 10_000 ? "down" : ""}`}>{out.liq != null ? usd(out.liq) : "–"}</b>
            </div>
            <div>
              <span>Buys / sells, 5 min</span>
              <b className="mono">{out.m5 ? `${out.m5.buys} / ${out.m5.sells}` : "–"}</b>
            </div>
            <div>
              <span>Buys / sells, 1 h</span>
              <b className="mono">{out.h1 ? `${out.h1.buys} / ${out.h1.sells}` : "–"}</b>
            </div>
            <div>
              <span>Volume, 1 h</span>
              <b className="mono">{out.vol1h != null ? usd(out.vol1h) : "–"}</b>
            </div>
          </div>
          <p className="pv-note">
            Bad signs: liquidity under $10K (hard to sell), more sells than buys, no trades in the last 5 minutes. No scam checks on this one:
            treat it as Risky at best.
          </p>
          <a className="pv-link" href={out.url} target="_blank" rel="noreferrer">
            Open on DexScreener ↗
          </a>
        </section>
      )}

      {rd && rd.checks.length > 0 && (
        <section className="pv-checks">
          <h3>Scam checks</h3>
          {rd.checks.map((c) => (
            <div key={c.label} className={c.ok ? "ok" : "bad"}>
              <span>{c.ok ? "✓" : "✗"}</span>
              <p>{c.label}</p>
            </div>
          ))}
        </section>
      )}

      {p && d && d.tone !== "down" && (
        <section className={`pv-plan ${d.tone === "up" ? "go" : "skip"}`}>
          <header>
            <h3>{d.tone === "up" ? "Your exit plan" : "If you buy anyway"}</h3>
            <span>{p.wins} of 30 similar coins won with it</span>
          </header>
          <div className="pv-plan-grid">
            {d.tone === "up" && (
              <div>
                <span>Take profit</span>
                <b className="up mono">+{Math.round((p.tp - 1) * 100)}%</b>
              </div>
            )}
            <div>
              <span>Sell if it falls</span>
              <b className="down mono">−{Math.round((1 - p.stop) * 100)}%</b>
            </div>
            <div>
              <span>Get out within</span>
              <b className="mono">{p.minutes} min</b>
            </div>
            <div>
              <span>Buy at most</span>
              <b className="mono">{buy.toFixed(2)} SOL</b>
            </div>
          </div>
          <p className="pv-note">
            {d.tone === "up"
              ? `Sell at +${Math.round((p.tp - 1) * 100)}%, at −${Math.round((1 - p.stop) * 100)}% or after ${p.minutes} minutes, whichever comes first.`
              : `No upside is expected: if you still buy, sell at −${Math.round((1 - p.stop) * 100)}% or after ${p.minutes} minutes.`}{" "}
            {buy.toFixed(2)} SOL means the stop costs you {lim.risk} SOL at most.
          </p>
          <RiskEdit lim={lim} setLim={setLim} />
        </section>
      )}

      <PaperBox mint={mint} plan={p} />

      {extra.length > 0 && (
        <section className="pv-flags">
          {extra.map((f) => (
            <div key={f.text} className={`pv-flag f-${f.tone}`}>
              <span>{f.icon}</span>
              <p>{f.text}</p>
            </div>
          ))}
        </section>
      )}

      {plain.length > 0 && (
        <section className="pv-plain">
          {plain.map((l) => (
            <div key={l.title} className={`p-${l.tone}`}>
              <span className="ic">{l.icon}</span>
              <div>
                <b>{l.title}</b>
                <p>{l.text}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      <details className="pv-help">
        <summary>How yeppo decides</summary>
        <dl>
          <dt>✅ OK to buy</dt>
          <dd>Every scam check passed and most of the 30 most similar past coins went up. Still a bet: follow the exit plan.</dd>
          <dt>⚠️ Risky</dt>
          <dd>No scam signs, but similar coins mostly went nowhere. Most coins are here. Skip it, or buy small with the stop.</dd>
          <dt>⛔ Don&apos;t buy</dt>
          <dd>A scam check failed, or similar coins usually crashed within 10 minutes.</dd>
          <dt>Scam checks</dt>
          <dd>What expert traders look at first: who holds the supply, the creator&apos;s record, bots faking a climb.</dd>
          <dt>Exit plan</dt>
          <dd>When to sell, picked from what the 30 most similar coins did. A plan from past coins, not a promise.</dd>
        </dl>
      </details>

      <a className="pv-full" href={`/c/${mint}`} target="_blank" rel="noreferrer">
        Open the full scan with the chart ↗
      </a>
    </div>
  );
}

const DECIDE_ICON = { up: "✅", mid: "⚠️", down: "⛔", learn: "⏳" } as const;
const DEX: Record<string, string> = { meteora: "Meteora", raydium: "Raydium", pumpswap: "PumpSwap, where pump.fun coins go once they graduate", pumpfun: "pump.fun", orca: "Orca", launchlab: "Raydium LaunchLab", moonshot: "Moonshot" };

export function RiskEdit({ lim, setLim }: { lim: Limits; setLim: (l: Limits) => void }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button className="pv-link" onClick={() => setOpen(true)}>
        Your limits: {lim.risk} SOL per trade, {lim.daily} SOL per day · change
      </button>
    );
  return (
    <form
      className="pv-limits"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const risk = Math.max(0.01, Math.min(100, Number(f.get("risk")) || DEFAULT_LIMITS.risk));
        const daily = Math.max(risk, Math.min(1000, Number(f.get("daily")) || DEFAULT_LIMITS.daily));
        const l = { risk, daily };
        keep("yo:limits", l);
        setLim(l);
        setOpen(false);
      }}
    >
      <label>
        Most I accept to lose on one trade
        <span>
          <input name="risk" defaultValue={lim.risk} inputMode="decimal" /> SOL
        </span>
      </label>
      <label>
        Most I accept to lose in a day
        <span>
          <input name="daily" defaultValue={lim.daily} inputMode="decimal" /> SOL
        </span>
      </label>
      <button className="btn btn-glow btn-sm">Save</button>
    </form>
  );
}

function WalletBox({
  who,
  setWho,
  g,
  track,
  lim,
  setLim,
  now,
}: {
  who: string | null;
  setWho: (w: string | null) => void;
  g: Guard | null;
  track: Track | null;
  lim: Limits;
  setLim: (l: Limits) => void;
  now: number;
}) {
  const [input, setInput] = useState("");
  const [err, setErr] = useState(false);
  const net = safety(g, lim, now);
  const reads = (g?.bags ?? []).map((b) => readBag(b, track));
  const order = ["out", "watch", "hold", "wait"];
  reads.sort((a, b) => order.indexOf(a.alarm) - order.indexOf(b.alarm));
  if (!who)
    return (
      <div className="pv-body">
        <div className="pv-empty">
          <h2>Guard your wallet</h2>
          <p>Paste the wallet your trading app uses. yeppo watches every coin it holds and tells you when to get out. Read-only: no keys, no signing.</p>
          <form
            className="pv-form"
            onSubmit={(e) => {
              e.preventDefault();
              const a = input.trim();
              if (!isMint(a)) return setErr(true);
              keep("yo:guard", a);
              setWho(a);
            }}
          >
            <input value={input} onChange={(e) => (setInput(e.target.value), setErr(false))} placeholder="Your wallet address" spellCheck={false} />
            <button className="btn btn-glow btn-sm">Guard it</button>
          </form>
          {err && <p className="pv-err">That is not a Solana wallet address.</p>}
        </div>
      </div>
    );
  return (
    <div className="pv-body">
      <section className={`pv-safety s-${net?.state ?? "ok"}`}>
        <header>
          <h3>Safety Net</h3>
          <span className="mono">{short(who)}</span>
        </header>
        <div className="pv-safety-row">
          <div>
            <span>Today</span>
            <b className={`mono ${(net?.today ?? 0) >= 0 ? "up" : "down"}`}>
              {(net?.today ?? 0) >= 0 ? "+" : ""}
              {(net?.today ?? 0).toFixed(2)} SOL
            </b>
          </div>
          <div>
            <span>Day limit</span>
            <b className="mono">−{lim.daily} SOL</b>
          </div>
          <div>
            <span>Trades today</span>
            <b className="mono">{net?.trades ?? 0}</b>
          </div>
        </div>
        <div className="pv-meter">
          <i style={{ width: `${Math.min(100, (Math.max(0, -(net?.today ?? 0)) / lim.daily) * 100)}%` }} />
        </div>
        <p className="pv-note">{net?.why ?? "Reading your wallet…"}</p>
        <RiskEdit lim={lim} setLim={setLim} />
      </section>

      <h3 className="pv-h">Open bags</h3>
      {!g ? (
        <div className="pv-skel" />
      ) : reads.length ? (
        reads.map((r) => {
          const a = ALARM[r.alarm];
          const [mint, , symbol, uri] = r.b;
          return (
            <a key={mint} className={`pv-bag ${a.cls}`} href={`/c/${mint}`} target="_blank" rel="noreferrer">
              <CoinImg uri={uri} symbol={symbol} size={30} />
              <div>
                <b>{symbol ? `$${symbol.replace(/^\$/, "")}` : short(mint)}</b>
                <p>{r.why}</p>
              </div>
              <div className="pv-bag-r">
                <span className={`alarm ${a.cls}`}>{a.label}</span>
                <b className={`mono ${r.pnl >= 0 ? "up" : "down"}`}>{mult(1 + r.pnl)}</b>
              </div>
            </a>
          );
        })
      ) : (
        <p className="pv-note">No open bags on coins yeppo follows. Buy one with this wallet and it shows up here within about 10 seconds.</p>
      )}
      <button
        className="pv-link"
        onClick={() => {
          keep("yo:guard", null);
          setWho(null);
        }}
      >
        Use another wallet
      </button>
    </div>
  );
}

/** the owner's paper trade on this coin: only where the lab key and a paper wallet are saved */
function PaperBox({ mint, plan: p }: { mint: string; plan: Plan | null }) {
  const [acct, setAcct] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (readLocal<string | null>("yo:lab", null)) setAcct(readLocal<string | null>("yo:paper", null));
  }, []);
  const { data: st, reload } = usePoll<PaperState>(acct ? () => paperState(acct) : null, 3000, acct ?? "");
  useEffect(() => setMsg(null), [mint]);
  if (!acct) return null;
  const pos = st?.positions.find((x) => x[0] === mint);
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
    <section className="pv-paper">
      <header>
        <h3>Paper trade</h3>
        <span className="pv-note">{st ? `${st.sol.toFixed(2)} paper SOL` : "…"}</span>
      </header>
      {pos ? (
        <>
          <div className="pv-plan-grid">
            <div>
              <span>In</span>
              <b className="mono">{pos[3].toFixed(2)} SOL</b>
            </div>
            <div>
              <span>Now</span>
              <b className={`mono ${pos[7] >= 0 ? "up" : "down"}`}>{mult(pos[3] > 0 ? pos[6] / pos[3] : 1)}</b>
            </div>
          </div>
          <p className="pv-note">{pos[8] ? `Exit plan on: sells by itself at ${mult(pos[8])}, ${mult(pos[9] ?? 0)} or the time limit.` : "No exit plan: sell by hand."}</p>
          <div className="pv-paper-btns">
            {[0.5, 1].map((f) => (
              <button key={f} className="btn btn-sm btn-ghost" disabled={!!busy} onClick={() => void run(`s${f}`, () => paperSell(acct, mint, f), "Sold ✓")}>
                {busy === `s${f}` ? "Selling…" : `Sell ${f * 100}%`}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="pv-paper-btns">
          {[0.1, 0.25, 0.5].map((v) => (
            <button key={v} className="btn btn-sm btn-glow" disabled={!!busy} onClick={() => void run(`b${v}`, () => paperBuy(acct, mint, v, p), "Bought ✓")}>
              {busy === `b${v}` ? "Buying…" : `Buy ${v} SOL${p ? " + plan" : ""}`}
            </button>
          ))}
        </div>
      )}
      {msg && <p className={msg.ok ? "pv-ok" : "pv-err"}>{msg.text}</p>}
    </section>
  );
}
