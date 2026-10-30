"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { age, isMint, mult, pct, short, sol as fmtSol, usd } from "@/lib/format";
import { usePoll, useNow, useSol } from "@/lib/hooks";
import { flags, MIN_N, verdict, type Flag, type Verdict } from "@/lib/oracle";
import { blip } from "@/lib/sound";
import { readLocal, rpc, writeLocal } from "@/lib/supabase";
import type { Bag, Guard as GuardData, Track } from "@/lib/types";
import { CoinImg } from "./Bits";
import { Footer } from "./Home";
import TopBar from "./TopBar";

type Alarm = "out" | "watch" | "hold" | "wait";
type BagRead = { b: Bag; v: Verdict | null; fl: Flag[]; alarm: Alarm; why: string; value: number; pnl: number };

const ALARM: Record<Alarm, { label: string; cls: string }> = {
  out: { label: "GET OUT", cls: "a-out" },
  watch: { label: "WATCH", cls: "a-watch" },
  hold: { label: "HOLD", cls: "a-hold" },
  wait: { label: "READING", cls: "a-wait" },
};

/** what Bag Guard says about one bag, most urgent reason first */
function readBag(b: Bag, track: Track | null): BagRead {
  const [, , , , , share, sin, sout, , , mc, , o, pattern, dev, devSold, soon] = b;
  const sig = { ladder: !!pattern?.ladder, devSold: !!devSold, dev };
  const ready = !!o && !o.old && o.n >= MIN_N && o.odds?.k > 0;
  const v = ready && o && !o.old ? verdict(o.odds, o.base, sig, track) : null;
  const fl = flags(sig);
  const value = ((share / 100) * 1e9 * (mc ?? 0)) / 1e9; // SOL: tokens x price, price = mc / supply
  const pnl = sin > 0 ? (value + sout) / sin - 1 : 0;
  let alarm: Alarm = "wait";
  let why = "The oracle is still learning coins of this age.";
  const red = fl.find((f) => f.tone === "down");
  if (red) {
    alarm = "out";
    why = red.text;
  } else if (v && (v.tone === "down" || v.tone === "rug")) {
    alarm = "out";
    why = v.line;
  } else if (soon >= 15) {
    alarm = "out";
    why = `${soon.toFixed(1)}% of the supply sits with wallets that usually sell within a minute.`;
  } else if (v?.tone === "up") {
    alarm = "hold";
    why = v.line;
  } else if (v) {
    alarm = "watch";
    why = soon >= 6 ? `${soon.toFixed(1)}% of the supply could be sold in the next minute. ${v.line}` : v.line;
  }
  return { b, v, fl, alarm, why, value, pnl };
}

function notify(text: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted") new Notification("yeppo Bag Guard", { body: text, icon: "/icon.svg" });
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
  useEffect(() => {
    setWho(readLocal<string | null>("yo:guard", null));
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
  return (
    <>
      <TopBar live={data ? `guarding ${short(data.who)}` : null} />
      <main className="wrap scan">
        <div className="guard-head glass">
          <div>
            <span className="lbl">Bag Guard</span>
            <h1 className="disp">yeppo watches your bags and tells you when to get out.</h1>
            <p className="dim">
              Paste the wallet your trading app uses (Axiom, GMGN, Photon, BullX…). Every coin it holds gets the oracle&apos;s read, the red flags
              and the sell pressure, live. Read-only: no keys, no signing.
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
            <h2 className="disp">Bag Guard can&apos;t read this wallet</h2>
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
                  <p className="small dim">Bag Guard follows coins yeppo watched from launch, up to a few hours old.</p>
                </div>
              )}
            </div>
            <div className="scan-side">
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
