"use client";

// The extension's view: the coin in front of you (verdict, exit plan, red flags, plain words) and, below,
// your wallet (Safety Net and every open bag with its alarm). Built for a 340 to 440 px wide side panel.
import { useEffect, useMemo, useState } from "react";
import { age, isMint, mult, short, usd } from "@/lib/format";
import { ALARM, DEFAULT_LIMITS, readBag, safety, type Limits } from "@/lib/guard";
import { usePoll, useNow, useSol } from "@/lib/hooks";
import { namesOf, type Names } from "@/lib/meta";
import { exitView, flags, maxBuy, MIN_N, plan, signalsOf, TONE_COLOR, verdict, type Plan } from "@/lib/oracle";
import { plainWords } from "@/lib/plain";
import { paperBuy, paperSell, paperState, type PaperState } from "@/lib/paper";
import { readLocal, rpc, writeLocal } from "@/lib/supabase";
import type { Future, Guard, TickRow, Track, Xray } from "@/lib/types";
import { CoinImg, Ring } from "./Bits";

const SITES = ["pump.fun", "GMGN", "Axiom", "Photon", "BullX", "DexScreener"];

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
            <p>Go to any coin on your trading site. yeppo spots it by itself and tells you what usually happens next.</p>
            <div className="pv-sites">
              {SITES.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
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
  const { data: fut, error: futErr } = usePoll<Future>(() => rpc<Future>("yr_future", { p_mint: mint }), 10_000, mint);
  const { data: xr } = usePoll<Xray>(() => rpc<Xray>("yr_xray", { p_mint: mint }), 10_000, mint);
  // the last minute of trades, for "right now"
  const { data: tk } = usePoll<{ now: number; ticks: TickRow[] }>(
    () => rpc("yr_ticks", { p_mints: [mint], p_since: Date.now() - 65_000 }),
    5000,
    mint,
  );
  const [named, setNamed] = useState<Names | null>(null);
  useEffect(() => {
    setNamed(null);
    if (fut && !(fut.tracked && fut.meta?.[1])) void namesOf([mint]).then((n) => n[mint] && setNamed(n[mint]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mint, !!fut]);

  const tr = fut && fut.tracked ? fut : null;
  const x = xr && xr.tracked ? xr : null;
  const o = tr?.oracle && !tr.oracle.old ? tr.oracle : null;
  const ready = !!o && o.n >= MIN_N && o.odds?.k > 0;
  const sig = signalsOf(x);
  const v = ready && o ? verdict(o.odds, o.base, sig, track) : null;
  const fl = x ? flags(sig) : [];
  const p = useMemo(() => (ready && o?.matches?.length ? plan(o.matches) : null), [ready, o?.matches]);
  const ticks = tk?.ticks ?? [];
  const last = ticks[ticks.length - 1];
  const bucket = tr?.path?.length ? tr.path[tr.path.length - 1][1] : 0;
  const mc = last && last[6] > 0 ? (last[5] / last[6]) * 1e9 : bucket;
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
  const ev = x ? exitView(x) : null;
  const soon = ev ? ev.overdue + ev.s30 + ev.s60 : 0;
  const plain = plainWords({ mcNow: mc, mcMinuteAgo: minute.ago, buys: minute.buys, sells: minute.sells, x, odds: ready && o ? o.odds : null, soon });
  const meta = tr?.meta?.[1] ? tr.meta : named ? [named.name, named.symbol, named.uri] : tr?.meta;
  const symbol = meta?.[1] ?? null;
  const tone = v?.tone ?? "learn";
  const color = TONE_COLOR[tone];
  const label = v ? v.label : !fut ? (futErr ? "Retrying…" : "Reading…") : !tr ? "Not followed" : tr.oracle?.old ? "Too old to read" : "Still learning";
  const line = v
    ? v.line
    : !fut
      ? futErr
        ? "yeppo is busy right now and keeps trying every 10 seconds."
        : "Comparing it with every coin yeppo watched."
      : !tr
        ? "yeppo reads pump.fun coins it watched from their first trade. This one launched before, or elsewhere."
        : tr.oracle?.old
          ? "yeppo reads coins in their first 40 minutes, when most of the move happens."
          : "The oracle needs a few more coins of this age before it gives odds.";
  const buy = p ? maxBuy(lim.risk, p.stop) : 0;

  return (
    <div className="pv-body">
      <div className="pv-coin">
        <CoinImg uri={meta?.[2]} symbol={symbol} size={38} />
        <div>
          <b>{symbol ? `$${symbol.replace(/^\$/, "")}` : short(mint)}</b>
          <span>{tr ? `${age(now - tr.t0)} old` : short(mint)}</span>
        </div>
        <div className="pv-mc">
          <b className="mono">{mc ? usd(mc * sol) : "–"}</b>
          <span>market cap</span>
        </div>
      </div>

      <section className={`pv-verdict t-${tone}`}>
        <Ring value={v ? v.score / 100 : 0} color={color} label="score" size={56} stroke={5} />
        <div>
          <b style={{ color }}>{label}</b>
          <p>{line}</p>
        </div>
      </section>

      {p && (
        <section className={`pv-plan ${p.go ? "go" : "skip"}`}>
          <header>
            <h3>Exit plan</h3>
            <span>{p.go ? "Worked on the look-alikes" : p.avg <= 0 ? "Lost money on the look-alikes" : "Lost more often than it won"}</span>
          </header>
          {p.go ? (
            <>
              <div className="pv-plan-grid">
                <div>
                  <span>Take profit</span>
                  <b className="up mono">+{Math.round((p.tp - 1) * 100)}%</b>
                </div>
                <div>
                  <span>Cut the loss</span>
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
                Sell when it is up {Math.round((p.tp - 1) * 100)}%, or down {Math.round((1 - p.stop) * 100)}%, or after {p.minutes} minutes, whichever
                comes first. Buying {buy.toFixed(2)} SOL means the stop costs you {lim.risk} SOL, your limit per trade.
              </p>
            </>
          ) : (
            <p className="pv-note">
              {p.avg <= 0
                ? "yeppo tried the best simple plan on the 30 coins that looked like this one and it lost money: skip this one, or wait for a Runner call."
                : "yeppo tried the best simple plan on the 30 coins that looked like this one and it lost more often than it won: a few big wins hide many losses. Skip it, or wait for a Runner call."}
            </p>
          )}
          <div className="pv-replay">
            <span className="up">{p.wins} won</span>
            <span className="down">{p.losses} lost</span>
            <span>{p.even} even</span>
            <span className={p.avg >= 0 ? "up" : "down"}>avg {p.avg >= 0 ? "+" : ""}{Math.round(p.avg * 100)}%</span>
          </div>
          <RiskEdit lim={lim} setLim={setLim} />
        </section>
      )}

      <PaperBox mint={mint} plan={p} />

      {fl.length > 0 && (
        <section className="pv-flags">
          {fl.map((f) => (
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
        <summary>What these words mean</summary>
        <dl>
          <dt>Look-alikes</dt>
          <dd>The 30 past coins that looked the most like this one at the same age: price moves, buyers, holders, creator.</dd>
          <dt>Score</dt>
          <dd>0 to 100. Above 65: most look-alikes went up. Below 30: most crashed.</dd>
          <dt>Exit plan</dt>
          <dd>Where to take profit, where to cut and how long to stay, picked from what the look-alikes did. A plan from past coins, not a promise.</dd>
          <dt>Bot ladder</dt>
          <dd>A straight climb made only of buys. Bots fake demand this way, then dump.</dd>
          <dt>Serial rugger</dt>
          <dd>A creator who dumped most of the coins yeppo saw them launch.</dd>
        </dl>
      </details>

      <a className="pv-full" href={`/c/${mint}`} target="_blank" rel="noreferrer">
        Open the full scan with the chart ↗
      </a>
    </div>
  );
}

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
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (readLocal<string | null>("yo:lab", null)) setAcct(readLocal<string | null>("yo:paper", null));
  }, []);
  const { data: st } = usePoll<PaperState>(acct ? () => paperState(acct) : null, 3000, acct ?? "");
  if (!acct) return null;
  const pos = st?.positions.find((x) => x[0] === mint);
  const run = (f: () => Promise<unknown>) => {
    setErr(null);
    f().catch((e) => setErr(e instanceof Error ? e.message : "Something went wrong"));
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
              <button key={f} className="btn btn-sm btn-ghost" onClick={() => run(() => paperSell(acct, mint, f))}>
                Sell {f * 100}%
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="pv-paper-btns">
          {[0.1, 0.25, 0.5].map((v) => (
            <button key={v} className="btn btn-sm btn-glow" onClick={() => run(() => paperBuy(acct, mint, v, p))}>
              Buy {v} SOL{p ? " + plan" : ""}
            </button>
          ))}
        </div>
      )}
      {err && <p className="pv-err">{err}</p>}
    </section>
  );
}
