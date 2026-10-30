"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { age, LAUNCH_MC, mult, short, usd } from "@/lib/format";
import { usePoll, useNow, useSol } from "@/lib/hooks";
import { cone, exitView, tradeLinks, verdict, type Verdict } from "@/lib/oracle";
import { blip } from "@/lib/sound";
import { Story, type StoryEvent } from "@/lib/story";
import { rpc } from "@/lib/supabase";
import type { Future, Kind, Match, TickRow, Xray } from "@/lib/types";
import { CoinImg, Ring } from "./Bits";
import FutureChart, { type Pt } from "./FutureChart";
import { Footer } from "./Home";
import { MIN_N } from "./HotBoard";
import { ExitClock, Holders, LearningBanner, OddsGrid, StoryFeed, VerdictBanner } from "./Panels";
import TopBar from "./TopBar";

type Tracked = Extract<Future, { tracked: true }>;
type XrayT = Extract<Xray, { tracked: true }>;

/** a Document Picture-in-Picture window (Chrome, Edge, Brave, Arc) with the page's styles copied in */
async function openPip(width: number, height: number): Promise<Window | null> {
  const dpip = (window as unknown as { documentPictureInPicture?: { requestWindow(o: { width: number; height: number }): Promise<Window> } })
    .documentPictureInPicture;
  if (!dpip) return null;
  const win = await dpip.requestWindow({ width, height });
  for (const ss of Array.from(document.styleSheets)) {
    try {
      const el = win.document.createElement("style");
      el.textContent = Array.from(ss.cssRules)
        .map((r) => r.cssText)
        .join("\n");
      win.document.head.appendChild(el);
    } catch {
      if (ss.href) {
        const l = win.document.createElement("link");
        l.rel = "stylesheet";
        l.href = ss.href;
        win.document.head.appendChild(l);
      }
    }
  }
  win.document.documentElement.className = document.documentElement.className;
  win.document.body.className = "pip-body";
  return win;
}

export default function Scan({ mint, mini }: { mint: string; mini?: boolean }) {
  const sol = useSol() || 150;
  const solRef = useRef(sol);
  solRef.current = sol;
  const now = useNow(1000);
  const { data: fut, error: futErr } = usePoll<Future>(() => rpc<Future>("yr_future", { p_mint: mint }), 10_000, mint);
  const { data: xr } = usePoll<Xray>(() => rpc<Xray>("yr_xray", { p_mint: mint }), 10_000, mint);
  const [ticks, setTicks] = useState<TickRow[]>([]);
  const [events, setEvents] = useState<StoryEvent[]>([]);
  const [hi, setHi] = useState<number | null>(null);
  const [pip, setPip] = useState<Window | null>(null);
  const [copied, setCopied] = useState(false);
  const [gotAt, setGotAt] = useState(0);
  const skew = useRef(0);
  const tagsRef = useRef<Record<string, Kind> | null>(null);
  const story = useRef<Story | null>(null);

  const tr: Tracked | null = fut && fut.tracked ? fut : null;
  const x: XrayT | null = xr && xr.tracked ? xr : null;
  tagsRef.current = x?.tags ?? null;

  useEffect(() => {
    if (fut) {
      skew.current = fut.now - Date.now();
      setGotAt(Date.now());
    }
  }, [fut]);
  useEffect(() => {
    if (tr?.dev) story.current?.setDev(tr.dev);
  }, [tr?.dev]);

  // live trades: the latest ones first, then every 1.5 s
  useEffect(() => {
    let alive = true;
    let since = 0;
    let first = true;
    let timer: ReturnType<typeof setTimeout>;
    const seen = new Set<string>();
    setTicks([]);
    setEvents([]);
    story.current = new Story(null, () => tagsRef.current, () => solRef.current);
    const tick = async () => {
      try {
        const r = await rpc<{ now: number; ticks: TickRow[] }>("yr_ticks", { p_mints: [mint], p_since: since });
        if (!alive) return;
        const fresh = r.ticks.filter((t) => {
          const k = `${t[8]}:${t[7]}:${t[2]}:${t[4]}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        if (fresh.length) {
          let mx = 0;
          for (const t of fresh) mx = Math.max(mx, t[1]);
          since = Math.max(since, mx - 1500);
          setTicks((p) => [...p, ...fresh].slice(-4000));
          const evs = story.current!.feed(fresh, first);
          if (evs.length) {
            setEvents((p) => [...evs.reverse(), ...p].slice(0, 80));
            if (!first) {
              const top = evs.find((e) => e.tone === "gold") ?? evs.find((e) => e.tone === "down") ?? evs[0];
              blip(top.tone);
            }
          }
        } else if (!since) since = r.now - 3000;
        first = false;
      } catch {
        /* the next round will do */
      }
      if (alive) timer = setTimeout(tick, document.hidden ? 6000 : 1500);
    };
    void tick();
    const idle = setInterval(() => {
      const evs = story.current?.idle(Date.now() + skew.current) ?? [];
      if (evs.length) setEvents((p) => [...evs, ...p].slice(0, 80));
    }, 5000);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(idle);
    };
  }, [mint]);

  const nowMs = now + skew.current;
  const lastTick = ticks[ticks.length - 1];
  const t0 = tr?.t0 ?? ticks[0]?.[1] ?? null;
  const bucketMc = tr?.path?.length ? tr.path[tr.path.length - 1][1] : 0;
  const mcNow = lastTick && lastTick[6] > 0 ? (lastTick[5] / lastTick[6]) * 1e9 : bucketMc;
  const nowS = t0 ? Math.max(1, (nowMs - t0) / 1000) : 0;
  const ath = Math.max(tr?.ath ?? 0, mcNow);

  // the chart's past: 10 s buckets from the oracle, or the live trades for coins it did not see born
  const past: Pt[] = useMemo(() => {
    if (!t0) return [];
    if (tr?.path?.length) {
      const pts: Pt[] = [{ s: 0, mc: LAUNCH_MC }];
      for (const b of tr.path) pts.push({ s: b[0] * 10 + 10, mc: b[1] });
      const lastB = tr.path[tr.path.length - 1][0];
      for (const t of ticks) if (t[1] > t0 + (lastB + 1) * 10000 && t[6] > 0) pts.push({ s: (t[1] - t0) / 1000, mc: (t[5] / t[6]) * 1e9 });
      return pts.filter((p) => p.s <= nowS);
    }
    const m = new Map<number, number>();
    for (const t of ticks) if (t[6] > 0) m.set(Math.floor((t[1] - t0) / 10000), (t[5] / t[6]) * 1e9);
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([b, mc]) => ({ s: b * 10 + 10, mc }));
  }, [tr?.path, ticks, t0, nowS]);

  const o = tr?.oracle && !tr.oracle.old ? tr.oracle : null;
  const ready = !!o && o.n >= MIN_N && o.odds?.k > 0;
  const matches: Match[] | null = ready && o?.matches?.length ? o.matches : null;
  const cn = useMemo(() => (matches ? cone(matches) : null), [matches]);
  const dp = x?.devpos;
  const devSold = !!dp && dp[4] > 0 && dp[1] < dp[0] * 0.1;
  const v: Verdict | null = ready && o ? verdict(o.odds, o.base, devSold) : null;
  const meta = tr?.meta;
  const symbol = meta?.[1] ?? null;
  const name = meta?.[0] ?? null;
  const ev = x ? exitView(x) : null;
  const soon = ev ? ev.overdue + ev.s30 + ev.s60 : 0;

  const popOut = async () => {
    const w = await openPip(360, 470).catch(() => null);
    if (w) {
      w.addEventListener("pagehide", () => setPip(null));
      setPip(w);
    } else window.open(`/c/${mint}?mini=1`, `yeppo-${mint.slice(0, 8)}`, "width=380,height=520");
  };
  useEffect(() => () => pip?.close(), [pip]);

  const hud = (
    <MiniHud
      mint={mint}
      symbol={symbol}
      uri={meta?.[2] ?? null}
      mc={mcNow * sol}
      ageS={nowS}
      v={v}
      learning={!ready}
      odds={o && ready ? o.odds : null}
      soon={soon}
      events={events}
      now={nowMs}
    />
  );
  if (mini) return hud;

  const live = tr ? `${(tr.recorded ?? 0).toLocaleString("en-US")} coins remembered` : fut ? "live" : null;
  const notTracked = fut && !fut.tracked;

  return (
    <>
      <TopBar live={live} />
      <main className="wrap scan">
        <div className="coin-head glass">
          <CoinImg uri={meta?.[2]} symbol={symbol} size={58} />
          <div className="who">
            <h1 className="disp">
              {symbol ? `$${symbol.replace(/^\$/, "")}` : "Coin"} <small>{name ?? ""}</small>
            </h1>
            <div className="coin-meta">
              <button
                className="copy-mint mono"
                onClick={() => {
                  void navigator.clipboard?.writeText(mint).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1400);
                  });
                }}
              >
                {copied ? "copied ✓" : `${short(mint)} ⧉`}
              </button>
              {t0 && <span>{age(nowMs - t0)} old</span>}
              {tr?.dev && (
                <a href={`https://gmgn.ai/sol/address/${tr.dev}`} target="_blank" rel="noreferrer">
                  dev {short(tr.dev)} ↗
                </a>
              )}
            </div>
          </div>
          <div className="coin-stats">
            <div>
              <b className="mono">{mcNow ? usd(mcNow * sol) : "–"}</b>
              <span>market cap</span>
            </div>
            <div>
              <b className="mono">{ath ? usd(ath * sol) : "–"}</b>
              <span>high</span>
            </div>
            <div>
              <b className="mono">{x ? x.holders : "–"}</b>
              <span>holders</span>
            </div>
          </div>
          <div className="links">
            {tradeLinks(mint).map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer">
                {l.label}
              </a>
            ))}
            <button className="btn btn-glow btn-sm" onClick={popOut} title="Keep the oracle on top of your trading app">
              ⧉ Pop out
            </button>
          </div>
        </div>

        <div className="scan-grid">
          <div className="scan-main">
            {futErr && !fut ? (
              <div className="notice glass">
                <h2 className="disp">The oracle is not reachable</h2>
                <p>{futErr}. It retries every 10 seconds.</p>
              </div>
            ) : !fut ? (
              <div className="skel" style={{ height: 150 }} />
            ) : notTracked ? (
              <div className="notice glass">
                <h2 className="disp">yeppo did not see this coin being born</h2>
                <p>
                  The oracle reads coins it watched from their very first trade: every pump.fun coin launched since yeppo started recording. Older
                  coins, coins that already left pump.fun and other launchpads are not covered yet.
                </p>
                <p className="small">Live trades below still work for any pump.fun coin traded in the last 20 minutes.</p>
              </div>
            ) : v && o && ready ? (
              <VerdictBanner v={v} k={o.odds.k} n={o.n} ageS={o.age_b * 10} fresh={(now - gotAt) / 1000} />
            ) : (
              <LearningBanner n={o?.n ?? 0} need={MIN_N} old={!!tr?.oracle?.old} />
            )}

            {o && ready && <OddsGrid o={o.odds} base={o.base} />}

            <div className="chart-box glass">
              <div className="chart-head">
                <div className="legend">
                  <span>
                    <i style={{ background: "linear-gradient(90deg,#38e1ff,#b9a4ff)" }} />
                    this coin
                  </span>
                  {matches && (
                    <>
                      <span>
                        <i style={{ background: "#eef1f8" }} />
                        middle path
                      </span>
                      <span>
                        <i style={{ background: "rgba(139,92,255,0.6)" }} />
                        half of the look-alikes
                      </span>
                      <span>
                        <i style={{ background: "#22e39a" }} />
                        pumped
                      </span>
                      <span>
                        <i style={{ background: "#ff4d6d" }} />
                        dumped
                      </span>
                    </>
                  )}
                </div>
                <span className="small dim">hover a ghost line to see that coin</span>
              </div>
              {past.length || mcNow ? (
                <FutureChart past={past} nowS={nowS} mcNow={mcNow} matches={matches} cone={cn} sol={sol} hi={hi} onHi={setHi} />
              ) : (
                <div className="chart-wrap">
                  <div className="chart-note">Waiting for trades…</div>
                </div>
              )}
              {matches && (
                <div className="alikes" style={{ marginTop: 10 }}>
                  {matches.slice(0, 18).map((m, i) => {
                    const end = m[4][m[4].length - 1];
                    return (
                      <button key={m[0]} className={`alike mono ${hi === i ? "on" : ""}`} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
                        {m[5] ? `$${m[5].slice(0, 10)}` : short(m[0])} <span className={end >= 1 ? "up" : "down"}>{mult(end)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {x && (
              <div className="panel glass">
                <h3>🔍 Who holds it</h3>
                <p className="hint">The 20 biggest wallets from the trades yeppo saw, with their habits across every coin they traded.</p>
                <Holders x={x} />
              </div>
            )}
          </div>

          <div className="scan-side">
            {x && <ExitClock x={x} />}
            <div className="panel glass">
              <h3>
                <i className="dot" /> Live play-by-play
              </h3>
              <p className="hint">Every move that matters: dev and sniper sells, smart money, whales, buy rushes and new highs.</p>
              <StoryFeed events={events} now={nowMs} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
      {pip && createPortal(hud, pip.document.body)}
    </>
  );
}

function MiniHud({
  mint,
  symbol,
  uri,
  mc,
  ageS,
  v,
  learning,
  odds,
  soon,
  events,
  now,
}: {
  mint: string;
  symbol: string | null;
  uri: string | null;
  mc: number;
  ageS: number;
  v: Verdict | null;
  learning: boolean;
  odds: { p50: number; dump: number } | null;
  soon: number;
  events: StoryEvent[];
  now: number;
}) {
  const color = v ? { up: "#22e39a", mid: "#ffb547", down: "#ff4d6d", rug: "#ff4d6d" }[v.tone] : "#8b5cff";
  return (
    <div className="mini">
      <div className="mini-top">
        <CoinImg uri={uri} symbol={symbol} size={28} />
        <b>{symbol ? `$${symbol.replace(/^\$/, "")}` : short(mint)}</b>
        <span className="mono dim">{mc ? usd(mc) : "–"}</span>
        <span className="dim" style={{ marginLeft: "auto" }}>
          {age(ageS * 1000)}
        </span>
      </div>
      <div className={`mini-verdict t-${v?.tone ?? "learn"}`}>
        <Ring value={v ? v.score / 100 : 0} color={color} label="score" size={50} stroke={5} />
        <div>
          <b style={{ color, fontSize: 15 }}>{v ? v.label : learning ? "Still learning" : "–"}</b>
          <div className="dim" style={{ fontSize: 11, lineHeight: 1.35 }}>
            {v ? v.line : "The oracle needs more coins of this age."}
          </div>
        </div>
      </div>
      <div className="mini-odds">
        <div>
          <b className="up mono">{odds ? `${Math.round(odds.p50 * 100)}%` : "–"}</b>
          <span className="dim">pump 50%</span>
        </div>
        <div>
          <b className="down mono">{odds ? `${Math.round(odds.dump * 100)}%` : "–"}</b>
          <span className="dim">dump 50%</span>
        </div>
        <div>
          <b className="amber mono">{soon.toFixed(1)}%</b>
          <span className="dim">sell in 60s</span>
        </div>
      </div>
      <StoryFeed events={events} now={now} limit={9} compact />
    </div>
  );
}
