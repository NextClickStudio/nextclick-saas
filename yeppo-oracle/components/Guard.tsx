"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { age, isMint, mult, pct, short, sol as fmtSol, usd } from "@/lib/format";
import { usePoll, useNow, useSol } from "@/lib/hooks";
import { ALARM, DEFAULT_LIMITS, readBag, safety, type Alarm, type BagRead, type Limits } from "@/lib/guard";
import { blip } from "@/lib/sound";
import { readLocal, rpc, writeLocal } from "@/lib/supabase";
import type { Bag, Guard as GuardData, Track } from "@/lib/types";
import { CoinImg } from "./Bits";
import { Footer } from "./Home";
import { RiskEdit } from "./PanelView";
import TopBar from "./TopBar";

function notify(text: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted") new Notification("yeppo", { body: text, icon: "/icon.svg" });
    navigator.vibrate?.([120, 60, 120]);
  } catch {
    /* no notifications here */
  }
}

export default function Guard() {
  const [who, setWho] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [notif, setNotif] = useState<string>("default");
  const [lim, setLim] = useState<Limits>(DEFAULT_LIMITS);
  useEffect(() => {
    setWho(readLocal<string | null>("yo:guard", null));
    setLim(readLocal<Limits>("yo:limits", DEFAULT_LIMITS));
    if ("Notification" in window) setNotif(Notification.permission);
  }, []);
  const sol = useSol() || 150;
  const now = useNow(1000);
  const { data, error } = usePoll<GuardData>(who ? () => rpc<GuardData>("yr_guard", { p_who: who }) : null, 6000, who ?? "");
  const { data: track } = usePoll<Track | null>(() => rpc<Track | null>("yr_otrack"), 300_000, "track");
  const reads = (data?.bags ?? []).map((b) => readBag(b, track ?? null));
  const order: Alarm[] = ["out", "watch", "hold", "wait"];
  reads.sort((a, b) => order.indexOf(a.alarm) - order.indexOf(b.alarm));

  // ring the alarm when a bag turns red
  const prev = useRef<Record<string, Alarm>>({});
  useEffect(() => {
    for (const r of reads) {
      const was = prev.current[r.b[0]];
      if (r.alarm === "out" && was && was !== "out") {
        blip("down");
        notify(`${r.b[2] ? `$${r.b[2]}` : short(r.b[0])}: ${r.why}`);
      }
      prev.current[r.b[0]] = r.alarm;
    }
  });

  const save = () => {
    const a = input.trim();
    if (!isMint(a)) {
      setErr("Paste a Solana wallet address");
      return;
    }
    setErr(null);
    writeLocal("yo:guard", a);
    setWho(a);
    setInput("");
  };
  const askNotif = async () => {
    try {
      setNotif(await Notification.requestPermission());
    } catch {
      /* unsupported */
    }
  };

  const h = data?.habits;
  const net = safety(data ?? null, lim, now);
  return (
    <>
      <TopBar live={data ? `guarding ${short(data.who)}` : null} />
      <main className="wrap scan">
        <div className="guard-head glass">
          <div>
            <span className="lbl">Wallet · Safety Net</span>
            <h1 className="disp">Your bags, guarded. Your limits, kept.</h1>
            <p className="dim">
              Paste the wallet your trading app uses (Axiom, GMGN, Photon, BullX…). Every coin it holds gets a clear call: GET OUT, WATCH or HOLD,
              with the reason in one line. Set your limits and yeppo tells you when to slow down or stop for the day. Read-only: no keys, no
              signing.
            </p>
          </div>
          <form
            className="search"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={who ? short(who) : "Your trading wallet address"} spellCheck={false} />
            <button className="btn btn-glow" type="submit">
              {who ? "Switch" : "Guard it"}
            </button>
            {err && <span className="search-err">{err}</span>}
          </form>
          {who && "Notification" in globalThis && notif !== "granted" && (
            <button className="btn btn-sm" onClick={askNotif}>
              🔔 Alert me when a bag turns red
            </button>
          )}
        </div>

        {!who ? null : error && !data ? (
          <div className="notice glass">
            <h2 className="disp">yeppo can&apos;t read this wallet</h2>
            <p>{error}</p>
          </div>
        ) : !data ? (
          <div className="skel" style={{ height: 160, marginTop: 14 }} />
        ) : (
          <div className="guard-grid">
            <div className="scan-main">
              {reads.length ? (
                reads.map((r) => <BagCard key={r.b[0]} r={r} now={now} sol={sol} />)
              ) : (
                <div className="notice glass">
                  <h2 className="disp">No open bags right now</h2>
                  <p>Buy a pump.fun coin with this wallet and it shows up here within about 10 seconds, with its alarm.</p>
                  <p className="small dim">yeppo follows coins it watched from launch, up to a few hours old.</p>
                </div>
              )}
            </div>
            <div className="scan-side">
              {net && (
                <div className={`pv-safety s-${net.state}`}>
                  <header>
                    <h3>{net.state === "stop" ? "⛔ Stop for today" : net.state === "slow" ? "✋ Slow down" : "🛡 Safety Net"}</h3>
                    <span>today</span>
                  </header>
                  <div className="pv-safety-row">
                    <div>
                      <span>Result</span>
                      <b className={`mono ${net.today >= 0 ? "up" : "down"}`}>
                        {net.today >= 0 ? "+" : ""}
                        {net.today.toFixed(2)} SOL
                      </b>
                    </div>
                    <div>
                      <span>Day limit</span>
                      <b className="mono">−{lim.daily} SOL</b>
                    </div>
                    <div>
                      <span>Trades</span>
                      <b className="mono">{net.trades}</b>
                    </div>
                  </div>
                  <div className="pv-meter">
                    <i style={{ width: `${Math.min(100, (Math.max(0, -net.today) / lim.daily) * 100)}%` }} />
                  </div>
                  <p className="pv-note">{net.why}</p>
                  <RiskEdit lim={lim} setLim={setLim} />
                </div>
              )}
              <div className="panel glass">
                <h3>🧬 Your habits</h3>
                <p className="hint">From every closed trade of this wallet yeppo saw.</p>
                {h ? (
                  <div className="dev-stats">
                    <div>
                      <b className="mono">{h.n}</b>
                      <span>trades</span>
                    </div>
                    <div>
                      <b className={`mono ${(h.win ?? 0) >= 0.5 ? "up" : "down"}`}>{pct(h.win)}</b>
                      <span>wins</span>
                    </div>
                    <div>
                      <b className="mono">{h.hold != null ? age(h.hold * 1000) : "–"}</b>
                      <span>avg hold</span>
                    </div>
                    <div>
                      <b className={`mono ${h.pnl >= 0 ? "up" : "down"}`}>{h.pnl >= 0 ? "+" : ""}{h.pnl.toFixed(1)}</b>
                      <span>SOL pnl</span>
                    </div>
                  </div>
                ) : (
                  <p className="small dim">No closed trade yet.</p>
                )}
                {h && (h.quick ?? 0) >= 0.5 && (
                  <p className="small" style={{ marginBottom: 0 }}>
                    ⚡ {pct(h.quick)} of your trades last under a minute.
                  </p>
                )}
              </div>
              {data.closed.length > 0 && (
                <div className="panel glass">
                  <h3>🧾 Last closed</h3>
                  <div className="closed">
                    {data.closed.map((c) => {
                      const r = c[2] > 0 ? c[3] / c[2] - 1 : 0;
                      return (
                        <Link key={c[0] + c[5]} href={`/c/${c[0]}`} className="closed-row">
                          <span>{c[1] ? `$${c[1]}` : short(c[0])}</span>
                          <span className="dim tiny">{age(now - c[5])} ago</span>
                          <span className={`mono ${r >= 0 ? "up" : "down"}`}>{mult(1 + r)}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

function BagCard({ r, now, sol }: { r: BagRead; now: number; sol: number }) {
  const [mint, name, symbol, uri, t0, share, sin, , t1, , , , o, , , , soon] = r.b;
  const a = ALARM[r.alarm];
  return (
    <div className={`bag glass ${a.cls}`}>
      <div className="bag-top">
        <CoinImg uri={uri} symbol={symbol} size={46} />
        <div className="ocard-name">
          <b>{symbol ? `$${symbol.replace(/^\$/, "")}` : short(mint)}</b>
          <span>
            {name ?? ""} · coin {age(now - t0)} · you {age(now - t1)}
          </span>
        </div>
        <span className={`alarm ${a.cls}`}>{a.label}</span>
      </div>
      <p className="bag-why">{r.why}</p>
      <div className="bag-stats">
        <div>
          <span className="lbl">Value</span>
          <b className="mono">{fmtSol(r.value, 3)}</b>
          <span className="tiny dim">{usd(r.value * sol)}</span>
        </div>
        <div>
          <span className="lbl">PnL</span>
          <b className={`mono ${r.pnl >= 0 ? "up" : "down"}`}>{mult(1 + r.pnl)}</b>
          <span className="tiny dim">in {fmtSol(sin, 3)}</span>
        </div>
        <div>
          <span className="lbl">Sell in 60s</span>
          <b className={`mono ${soon >= 15 ? "down" : soon >= 6 ? "amber" : ""}`}>{soon.toFixed(1)}%</b>
          <span className="tiny dim">of the supply</span>
        </div>
        <div>
          <span className="lbl">Look-alikes</span>
          <b className="mono">{o && !o.old && o.odds?.k ? `${Math.round(o.odds.dump * 100)}% dump` : "–"}</b>
          <span className="tiny dim">{o && !o.old && o.odds?.k ? `${Math.round(o.odds.p50 * 100)}% pump` : `you hold ${share.toFixed(2)}%`}</span>
        </div>
      </div>
      <div className="bag-links">
        <Link href={`/c/${mint}`}>Full scan →</Link>
        <a href={`https://gmgn.ai/sol/token/${mint}`} target="_blank" rel="noreferrer">
          Sell on GMGN ↗
        </a>
        <a href={`https://pump.fun/coin/${mint}`} target="_blank" rel="noreferrer">
          pump.fun ↗
        </a>
      </div>
    </div>
  );
}
