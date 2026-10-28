"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rpc } from "@/lib/supabase";
import { CoinState, flags, type Intel } from "@/lib/coin";
import { codename, type Codename } from "@/lib/codename";
import { age, clock, ordinal, pct, signed, sol, tone, usd } from "@/lib/format";
import { centerOf, confetti, edgeGlow, floatText, sfx, toast } from "@/lib/fx";
import type { Board, FeedEv, MatchInfo, Results, RosterRow } from "@/lib/types";
import { useApp } from "./AppProvider";
import Avatar from "./Avatar";
import CoinChart from "./CoinChart";
import CoinIcon from "./CoinIcon";
import ResultsView from "./ResultsView";

const TIPS = [
  "A dev who sells early is the loudest red flag there is.",
  "If the top 10 wallets own half the supply, they can dump it on you.",
  "Snipers bought in the first seconds. Watch what they do next.",
  "Buyers in control plus a growing holder count: that is what runners look like.",
  "Big buys move the price. Size in, don't ape your whole bag at once.",
  "Every cut keeps only the richest traders. Doing nothing gets you cut.",
  "Coins near 100% bonding graduate. Few make it.",
];

type Mine = { cash: number; pos: Map<number, number>; fills: [number, number, number, number, number][] };
type BannerT = { id: number; title: string; sub?: string; kind: "up" | "down" | "gold" };

function useNames(info: MatchInfo | null) {
  return useMemo(() => {
    const out = new Map<number, Codename>();
    if (!info) return out;
    const used = new Set<string>();
    for (const c of info.coins) {
      let n = codename(info.id, c.ci);
      let salt = 0;
      while (used.has(n.ticker) && salt < 6) n = codename(`${info.id}~${++salt}`, c.ci);
      used.add(n.ticker);
      out.set(c.ci, n);
    }
    return out;
  }, [info]);
}

export default function Match({ id }: { id: string }) {
  const router = useRouter();
  const { session, refreshMe } = useApp();
  const [info, setInfo] = useState<MatchInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const skew = useRef(0);
  const [tick, setTick] = useState(() => Date.now());
  const coins = useRef(new Map<number, CoinState>());
  const [ver, setVer] = useState(0);
  const since = useRef(0);
  const [board, setBoard] = useState<Board | null>(null);
  const [mine, setMine] = useState<Mine>({ cash: 10, pos: new Map(), fills: [] });
  const [sel, setSel] = useState<number | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [showResults, setShowResults] = useState(true);
  const [banner, setBanner] = useState<BannerT | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const lastResolved = useRef(0);
  const launched = useRef(new Set<number>());
  const names = useNames(info);

  const loadInfo = useCallback(async () => {
    const t0 = Date.now();
    try {
      const m = await rpc<MatchInfo>("yr_match", { p_match: id, p_secret: session?.secret ?? null });
      skew.current = m.server_now - (t0 + Date.now()) / 2;
      for (const c of m.coins) if (!coins.current.has(c.ci)) coins.current.set(c.ci, new CoinState(c.ci, c.at, c.sol_usd, m.speed));
      setInfo(m);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load the match");
    }
  }, [id, session]);

  useEffect(() => {
    void loadInfo();
  }, [loadInfo]);

  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const matchMs = info ? tick + skew.current - info.start_at : -1;
  const started = matchMs >= 0;
  const over = info ? matchMs >= info.dur_ms : false;
  const done = !!results && !results.pending;

  // roster gets its AI traders when the match starts
  useEffect(() => {
    if (info && started && (!info.roster || info.roster.length < info.size) && matchMs > 1200) {
      const t = setTimeout(loadInfo, 300);
      return () => clearTimeout(t);
    }
  }, [info, started, matchMs, loadInfo]);

  // ---- market feed ----
  useEffect(() => {
    if (!info || !started) return;
    let dead = false;
    let timer: ReturnType<typeof setTimeout>;
    const pull = async () => {
      try {
        const r = await rpc<{ now: number; ev: FeedEv[]; more: boolean }>("yr_feed", { p_match: id, p_since: since.current });
        if (dead) return;
        let maxMs = since.current;
        const newly: number[] = [];
        for (const e of r.ev) {
          const c = coins.current.get(e[0]);
          if (!c) continue;
          c.add(e);
          if (e[1] > maxMs) maxMs = e[1];
          if (!launched.current.has(e[0])) {
            launched.current.add(e[0]);
            newly.push(e[0]);
          }
        }
        since.current = maxMs;
        if (r.ev.length) setVer((v) => v + 1);
        if (newly.length) {
          setFresh((s) => new Set([...s, ...newly]));
          setSel((cur) => (cur == null ? newly[0] : cur));
          if (since.current > 1500) {
            sfx.coin();
            const nm = names.get(newly[0]);
            if (nm) toast(`New launch: $${nm.ticker}`, "gold");
          }
          setTimeout(() => setFresh((s) => new Set([...s].filter((x) => !newly.includes(x)))), 1500);
        }
        timer = setTimeout(pull, r.more ? 50 : 1000);
      } catch {
        timer = setTimeout(pull, 2000);
      }
    };
    void pull();
    return () => {
      dead = true;
      clearTimeout(timer);
    };
  }, [info, started, id, names]);

  // ---- standings ----
  const pullBoard = useCallback(async () => {
    try {
      const b = await rpc<Board>("yr_board", { p_match: id, p_secret: session?.secret ?? null });
      setBoard(b);
      if (b.me) setMine({ cash: b.me.cash, pos: new Map(Object.entries(b.me.pos).map(([k, v]) => [Number(k), v])), fills: b.me.fills });
    } catch {
      /* next tick */
    }
  }, [id, session]);

  useEffect(() => {
    if (!info || !started || done) return;
    void pullBoard();
    const t = setInterval(pullBoard, 1500);
    return () => clearInterval(t);
  }, [info, started, done, pullBoard]);

  const roster = useMemo(() => new Map<number, RosterRow>((info?.roster ?? []).map((r) => [r[0], r])), [info]);
  const meSlot = info?.me ?? null;
  const myRow = board?.rows?.find((r) => r[0] === meSlot) ?? null;
  const eliminated = myRow?.[3] != null;
  const aliveRows = useMemo(() => (board?.rows ?? []).filter((r) => r[3] == null).sort((a, b) => b[1] - a[1]), [board]);
  const myRank = meSlot == null ? null : aliveRows.findIndex((r) => r[0] === meSlot) + 1 || null;
  const nextCut = info?.cuts.find((c) => c.at > matchMs) ?? null;
  const cutIdx = info && nextCut ? info.cuts.indexOf(nextCut) : -1;
  const toCut = nextCut ? nextCut.at - matchMs : 0;
  const prevAt = cutIdx > 0 && info ? info.cuts[cutIdx - 1].at : 0;
  const inDanger = !!(started && !eliminated && !over && myRank && nextCut && myRank > nextCut.keep);
  const hot = inDanger && toCut < 20_000;

  // cut resolved: survive or die
  useEffect(() => {
    if (!board || !info || meSlot == null) return;
    if (board.resolved > lastResolved.current) {
      const cut = info.cuts[board.resolved - 1];
      lastResolved.current = board.resolved;
      if (!cut) return;
      if (eliminated) {
        sfx.lose();
        edgeGlow("down");
        setBanner({ id: Date.now(), title: "Eliminated", sub: `You finished ${ordinal(myRow?.[4] ?? 0)} of ${info.size}`, kind: "down" });
      } else {
        sfx.rank();
        confetti();
        edgeGlow("up");
        setBanner({ id: Date.now(), title: `Cut ${board.resolved} survived`, sub: `${cut.keep} traders left`, kind: "up" });
      }
    }
  }, [board, info, meSlot, eliminated, myRow]);

  // heartbeat in the danger zone
  useEffect(() => {
    if (hot) sfx.tick();
  }, [hot, Math.floor(matchMs / 1000)]); // eslint-disable-line react-hooks/exhaustive-deps

  // results once we are out or the match ended
  useEffect(() => {
    if (!session || done || meSlot == null) return;
    if (!(eliminated || board?.finished || over)) return;
    let dead = false;
    const go = async () => {
      try {
        const r = await rpc<Results>("yr_results", { p_secret: session.secret, p_match: id });
        if (dead) return;
        if (r.pending) {
          setTimeout(go, 1500);
          return;
        }
        setResults(r);
        void refreshMe();
        if (r.place === 1) {
          sfx.win();
          confetti();
          setTimeout(() => confetti(), 400);
        }
      } catch {
        setTimeout(go, 2500);
      }
    };
    const t = setTimeout(go, eliminated ? 2600 : 800);
    return () => {
      dead = true;
      clearTimeout(t);
    };
  }, [session, done, meSlot, eliminated, board?.finished, over, id, refreshMe]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 2700);
    return () => clearTimeout(t);
  }, [banner]);

  if (err) {
    return (
      <main className="center">
        <div>
          <p className="err">{err}</p>
          <Link href="/" className="btn btn-gold" style={{ marginTop: 14 }}>
            Back to lobby
          </Link>
        </div>
      </main>
    );
  }
  if (!info) {
    return (
      <main className="center">
        <i className="spinner" />
      </main>
    );
  }

  if (!started) return <Pregame info={info} matchMs={matchMs} />;

  const coinList = [...info.coins].sort((a, b) => a.at - b.at);
  const selCoin = sel != null ? coins.current.get(sel) ?? null : null;
  const selIntel = selCoin && selCoin.launched(matchMs) ? selCoin.intel(matchMs) : null;
  const equity = mine.cash + [...mine.pos].reduce((s, [ci, tok]) => s + tok * (coins.current.get(ci)?.price() ?? 0), 0);
  const pnlPct = ((equity - info.start_sol) / info.start_sol) * 100;
  const canTrade = !!session && meSlot != null && !eliminated && !over && !done;

  return (
    <>
      <div className="world" />
      {inDanger && <div className="danger-vignette" />}
      <main className="hud">
        <header className="hud-top">
          <div className="left">
            <Link href="/" className="logo display" style={{ fontSize: 14 }}>
              yeppo <b>royale</b>
            </Link>
            <span className="chip">{info.mode_name}</span>
            <span className="chip mono">{clock(info.dur_ms - matchMs)} left</span>
          </div>
          <div className="alive">
            <div className="alive-count">
              <span className="display">{board?.alive ?? info.size}</span>
              <span className="lbl">alive</span>
            </div>
            {nextCut ? (
              <div className={`storm ${hot ? "hot" : ""}`}>
                <div className="storm-top">
                  <span>CUT {cutIdx + 1}: TOP {nextCut.keep} SURVIVE</span>
                  <span className="mono">{clock(toCut)}</span>
                </div>
                <div className="bar">
                  <i style={{ width: `${Math.min(100, ((matchMs - prevAt) / (nextCut.at - prevAt)) * 100)}%` }} />
                </div>
              </div>
            ) : (
              <div className="storm">
                <div className="storm-top">
                  <span>FINAL ZONE</span>
                  <span className="mono">{clock(info.dur_ms - matchMs)}</span>
                </div>
                <div className="bar">
                  <i style={{ width: `${Math.min(100, (matchMs / info.dur_ms) * 100)}%` }} />
                </div>
              </div>
            )}
          </div>
          <div className="right">
            {inDanger && <span className="danger-tag">DANGER ZONE</span>}
            <div className="equity">
              <span className="lbl">Your bag</span>
              <div className={`display mono t-${tone(pnlPct)}`}>{sol(equity)} SOL</div>
            </div>
            <div className="myrank">
              <span className="lbl">{eliminated ? "Finished" : "Rank"}</span>
              <div className="display">{eliminated ? ordinal(myRow?.[4] ?? 0) : myRank ? `#${myRank}` : "—"}</div>
            </div>
          </div>
        </header>

        <section className="panel hud-coins">
          <div className="panel-head">
            <span className="lbl">
              <i className="live-dot" style={{ display: "inline-block", marginRight: 6 }} />
              The trenches
            </span>
            <span className="dim small">{launched.current.size}/{info.coins.length} launched</span>
          </div>
          <div className="coin-list">
            {coinList.map((c) => {
              const st = coins.current.get(c.ci)!;
              const nm = names.get(c.ci)!;
              if (!st.launched(matchMs)) {
                return (
                  <div key={c.ci} className="coin-row pending">
                    <div className="coin-ico mono dim" style={{ background: "var(--bg2)" }}>
                      ··
                    </div>
                    <div className="nm">
                      <b>Next launch</b>
                      <span className="mono">in {clock(c.at - matchMs)}</span>
                    </div>
                    <span />
                  </div>
                );
              }
              const it = st.intel(matchMs);
              const held = (mine.pos.get(c.ci) ?? 0) > 0;
              return (
                <button key={c.ci} className={`coin-row ${sel === c.ci ? "sel" : ""} ${fresh.has(c.ci) ? "new" : ""}`} onClick={() => setSel(c.ci)}>
                  <CoinIcon nm={nm} />
                  <div className="nm">
                    <b>
                      ${nm.ticker}
                      {held && <i className="held-dot" />}
                    </b>
                    <span className="mono">
                      {age(it.ageMs)} · {it.holders} holders
                    </span>
                    <div className="mini-flags">
                      {flags(it)
                        .slice(0, 4)
                        .map((f, i) => (
                          <i key={i} style={{ background: f.tone === "up" ? "var(--up)" : f.tone === "down" ? "var(--down)" : "var(--warn)" }} />
                        ))}
                    </div>
                  </div>
                  <div className="px mono">
                    <b>{usd(it.mcUsd)}</b>
                    <span className={`t-${tone(it.chg)}`}>{pct(it.chg, 0)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="hud-main">
          {selCoin && selIntel ? (
            <CoinPanel coin={selCoin} intel={selIntel} name={names.get(selCoin.ci)!} info={info} ver={ver} mine={mine} />
          ) : (
            <div className="panel center" style={{ minHeight: 300 }}>
              <div>
                <p className="display" style={{ fontSize: 15 }}>
                  First launch incoming
                </p>
                <p className="muted" style={{ marginTop: 6 }}>
                  {TIPS[Math.floor(matchMs / 6000) % TIPS.length]}
                </p>
              </div>
            </div>
          )}
        </section>

        <aside className="hud-side">
          <TradeBox
            key={sel ?? -1}
            coin={selCoin && selCoin.launched(matchMs) ? selCoin : null}
            name={sel != null ? names.get(sel) ?? null : null}
            mine={mine}
            canTrade={canTrade}
            reason={!session ? "Log in to trade" : meSlot == null ? "Spectating" : eliminated ? "You were eliminated" : over || done ? "Match over" : ""}
            onTrade={async (side, amount, el) => {
              if (!session || sel == null) return;
              try {
                const r = await rpc<{ cash: number; held: number; sol: number; tok: number }>("yr_trade", {
                  p_secret: session.secret,
                  p_match: id,
                  p_ci: sel,
                  p_side: side,
                  p_amount: amount,
                });
                const { x, y } = centerOf(el);
                const nm = names.get(sel);
                if (side === "buy") {
                  sfx.buy();
                  floatText(`+ $${nm?.ticker ?? ""}`, x, y - 30, "up");
                } else {
                  const buys = mine.fills.filter((f) => f[0] === sel && f[1] === 1);
                  const spent = buys.reduce((s, f) => s + f[2], 0);
                  const got = buys.reduce((s, f) => s + f[3], 0);
                  const gain = r.sol - (got > 0 ? (spent / got) * r.tok : 0);
                  if (gain >= 0) {
                    sfx.win();
                    confetti(x, y);
                    edgeGlow("up");
                  } else {
                    sfx.lose();
                    edgeGlow("down");
                  }
                  floatText(`${signed(gain, 2)} SOL`, x, y - 30, gain >= 0 ? "up" : "down");
                }
                setMine((m) => {
                  const pos = new Map(m.pos);
                  if (r.held > 0) pos.set(sel, r.held);
                  else pos.delete(sel);
                  return { cash: r.cash, pos, fills: [...m.fills, [sel, side === "buy" ? 1 : 2, r.sol, r.tok, matchMs]] };
                });
                void pullBoard();
              } catch (e) {
                sfx.error();
                toast(e instanceof Error ? e.message : "Trade failed", "down");
              }
            }}
          />
          <Positions mine={mine} coins={coins.current} names={names} onPick={setSel} />
          <Standings info={info} board={board} roster={roster} aliveRows={aliveRows} meSlot={meSlot} keep={nextCut?.keep ?? null} />
          <KillFeed board={board} roster={roster} names={names} />
        </aside>
      </main>

      {banner && (
        <div key={banner.id} className={`banner ${banner.kind}`}>
          <div className="display">{banner.title}</div>
          {banner.sub && <p>{banner.sub}</p>}
        </div>
      )}

      {results && !results.pending && showResults && (
        <ResultsView
          results={results}
          info={info}
          names={names}
          onWatch={!results.finished ? () => setShowResults(false) : undefined}
          onAgain={async () => {
            if (!session) return;
            try {
              const r = await rpc<{ id: string }>("yr_join", { p_secret: session.secret, p_mode: info.mode });
              router.push(`/play/${r.id}`);
            } catch (e) {
              toast(e instanceof Error ? e.message : "Could not join", "down");
            }
          }}
        />
      )}
      {results && !results.pending && !showResults && (
        <button className="btn btn-gold" style={{ position: "fixed", right: 18, bottom: 18, zIndex: 85 }} onClick={() => setShowResults(true)}>
          Your results
        </button>
      )}
    </>
  );
}

function Pregame({ info, matchMs }: { info: MatchInfo; matchMs: number }) {
  const left = -matchMs;
  const last = useRef(-1);
  const sec = Math.ceil(left / 1000);
  useEffect(() => {
    if (sec !== last.current && sec <= 5 && sec > 0) sfx.tick();
    if (sec <= 0 && last.current > 0) sfx.go();
    last.current = sec;
  }, [sec]);
  const humans = info.roster ?? [];
  return (
    <>
      <div className="world" />
      <main className="pregame">
        <span className="chip chip-gold">{info.mode_name.toUpperCase()}</span>
        <p className="lbl">Dropping in</p>
        <div key={sec} className={`count display mono ${sec <= 5 ? "go" : ""}`}>
          {sec > 59 ? clock(left) : Math.max(0, sec)}
        </div>
        <p className="muted">
          {humans.length} trader{humans.length === 1 ? "" : "s"} in the lobby · AI traders fill the other {Math.max(0, info.size - humans.length)} spots at the drop
        </p>
        <div className="squad">
          {humans.map((r) => (
            <span key={r[0]} className="who">
              <Avatar look={r[2]} size={22} /> {r[1]}
            </span>
          ))}
        </div>
        <p className="tips">{TIPS[Math.floor(Date.now() / 5000) % TIPS.length]}</p>
        <div className="row-gap" style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
          <span className="chip">Start with {info.start_sol} play SOL</span>
          <span className="chip">{info.coins.length} real launches</span>
          <span className="chip">{info.cuts.length} cuts</span>
        </div>
        <Link href="/" className="btn btn-ghost btn-sm">
          Back to lobby (you stay queued)
        </Link>
      </main>
    </>
  );
}

function CoinPanel({ coin, intel, name, info, ver, mine }: { coin: CoinState; intel: Intel; name: Codename; info: MatchInfo; ver: number; mine: Mine }) {
  const meta = info.coins.find((c) => c.ci === coin.ci);
  const fills = mine.fills.filter((f) => f[0] === coin.ci).map((f) => ({ ms: f[4], k: f[1] }));
  const buys = mine.fills.filter((f) => f[0] === coin.ci && f[1] === 1);
  const spent = buys.reduce((s, f) => s + f[2], 0);
  const got = buys.reduce((s, f) => s + f[3], 0);
  const entryUsd = got > 0 && (mine.pos.get(coin.ci) ?? 0) > 0 ? (spent / got) * 1e9 * coin.solUsd : null;
  const fl = flags(intel);
  return (
    <>
      <div className="panel">
        <div className="coin-head">
          <CoinIcon nm={name} size={36} />
          <div>
            <h2 className="display">{name.name}</h2>
            <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              <span className="chip mono">${name.ticker}</span>
              <span className="chip mono">{age(intel.ageMs)} old</span>
              {meta?.x && <span className="chip">𝕏</span>}
              {meta?.tg && <span className="chip">Telegram</span>}
              {meta?.web && <span className="chip">Website</span>}
              {!meta?.x && !meta?.tg && !meta?.web && <span className="chip chip-warn">No socials</span>}
            </div>
          </div>
          <div className="mc">
            <span className="lbl">Market cap</span>
            <div className={`display mono t-${tone(intel.chg)}`}>{usd(intel.mcUsd)}</div>
            <span className="mono small muted">
              {pct(intel.chg, 0)} from launch · ATH {usd(intel.athUsd)}
            </span>
          </div>
        </div>
        <CoinChart coin={coin} version={ver} fills={fills} entryUsd={entryUsd} />
      </div>
      <div className="panel">
        <div className="panel-head">
          <span className="lbl">Intel</span>
          <span className="dim small">live from the replay</span>
        </div>
        <div className="intel">
          <div className="cell">
            <span className="lbl">Holders</span>
            <b className="mono">{intel.holders}</b>
          </div>
          <div className="cell">
            <span className="lbl">Top 10 hold</span>
            <b className={`mono ${intel.top10 >= 45 ? "t-down" : intel.top10 >= 30 ? "t-warn" : "t-up"}`}>{intel.top10.toFixed(1)}%</b>
          </div>
          <div className="cell">
            <span className="lbl">Dev holds</span>
            <b className={`mono ${intel.devSold ? "t-down" : intel.dev >= 10 ? "t-warn" : ""}`}>{intel.dev.toFixed(1)}%</b>
          </div>
          <div className="cell">
            <span className="lbl">Snipers hold</span>
            <b className={`mono ${intel.snipers >= 25 ? "t-down" : intel.snipers >= 12 ? "t-warn" : ""}`}>{intel.snipers.toFixed(1)}%</b>
          </div>
          <div className="cell">
            <span className="lbl">Buys / sells 1m</span>
            <b className="mono">
              <span className="t-up">{intel.buys}</span> / <span className="t-down">{intel.sells}</span>
            </b>
          </div>
          <div className="cell">
            <span className="lbl">Volume 1m</span>
            <b className="mono">{sol(intel.buyVol + intel.sellVol, 1)} SOL</b>
          </div>
          <div className="cell">
            <span className="lbl">Trades</span>
            <b className="mono">{intel.txs}</b>
          </div>
          <div className="cell">
            <span className="lbl">Bonding curve</span>
            <b className="mono">{intel.progress.toFixed(0)}%</b>
            <div className="progress">
              <i style={{ width: `${intel.progress}%` }} />
            </div>
          </div>
        </div>
        <div className="flags">
          {fl.map((f) => (
            <span key={f.text} className={`chip chip-${f.tone === "up" ? "up" : f.tone === "down" ? "down" : "warn"}`}>
              {f.tone === "up" ? "✓" : f.tone === "down" ? "✕" : "!"} {f.text}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

function TradeBox({
  coin,
  name,
  mine,
  canTrade,
  reason,
  onTrade,
}: {
  coin: CoinState | null;
  name: Codename | null;
  mine: Mine;
  canTrade: boolean;
  reason: string;
  onTrade: (side: "buy" | "sell", amount: number, el: HTMLElement | null) => Promise<void>;
}) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amt, setAmt] = useState("1");
  const [busy, setBusy] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const held = coin ? mine.pos.get(coin.ci) ?? 0 : 0;
  const v = Math.max(0, parseFloat(amt.replace(",", ".")) || 0);
  // sell box is in % of the position
  const sellTok = side === "sell" ? (held * Math.min(100, v)) / 100 : 0;
  const q = coin ? (side === "buy" ? coin.quote("buy", v) : coin.quote("sell", sellTok)) : { tok: 0, sol: 0, impact: 0 };
  let label = side === "buy" ? `Buy $${name?.ticker ?? ""}` : `Sell $${name?.ticker ?? ""}`;
  let disabled = busy || !coin || !canTrade;
  if (!canTrade) label = reason;
  else if (!coin) label = "Pick a coin";
  else if (side === "buy" && v > mine.cash + 1e-9) {
    label = "Not enough SOL";
    disabled = true;
  } else if (side === "buy" && v < 0.01) disabled = true;
  else if (side === "sell" && held <= 0) {
    label = "Nothing to sell";
    disabled = true;
  }
  return (
    <div className="panel">
      <div className="seg">
        <button
          className={side === "buy" ? "on buy" : ""}
          onClick={() => {
            setSide("buy");
            setAmt("1");
          }}
        >
          Buy
        </button>
        <button
          className={side === "sell" ? "on sell" : ""}
          onClick={() => {
            setSide("sell");
            setAmt("100");
          }}
        >
          Sell
        </button>
      </div>
      <div className="amount">
        <input className="input" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} />
        <span>{side === "buy" ? "SOL" : "%"}</span>
      </div>
      <div className="presets">
        {(side === "buy" ? ["0.5", "1", "2", "5"] : ["25", "50", "75", "100"]).map((p) => (
          <button key={p} onClick={() => setAmt(p)}>
            {side === "buy" ? p : `${p}%`}
          </button>
        ))}
      </div>
      <div className="quote mono">
        {side === "buy" ? (
          <>
            <span>You get</span>
            <b>{q.tok > 0 ? `${(q.tok / 1e6).toFixed(2)}M $${name?.ticker ?? ""}` : "—"}</b>
          </>
        ) : (
          <>
            <span>You receive</span>
            <b>{q.sol > 0 ? `${sol(q.sol, 3)} SOL` : "—"}</b>
          </>
        )}
        <span>Price impact</span>
        <b className={q.impact > 8 ? "t-down" : q.impact > 3 ? "t-warn" : ""}>{q.impact > 0 ? `${q.impact.toFixed(1)}%` : "—"}</b>
        <span>Cash</span>
        <b>{sol(mine.cash)} SOL</b>
      </div>
      <button
        ref={btn}
        className={`btn btn-block big-trade ${side === "buy" ? "btn-buy" : "btn-sell"}`}
        disabled={disabled}
        onClick={async () => {
          setBusy(true);
          await onTrade(side, side === "buy" ? v : sellTok, btn.current);
          setBusy(false);
        }}
      >
        {busy ? "…" : label}
      </button>
    </div>
  );
}

function Positions({ mine, coins, names, onPick }: { mine: Mine; coins: Map<number, CoinState>; names: Map<number, Codename>; onPick: (ci: number) => void }) {
  const rows = [...mine.pos].filter(([, tok]) => tok > 0);
  if (!rows.length) return null;
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="lbl">Your bags</span>
      </div>
      {rows.map(([ci, tok]) => {
        const c = coins.get(ci);
        const nm = names.get(ci);
        const value = tok * (c?.price() ?? 0);
        const f = mine.fills.filter((x) => x[0] === ci);
        const spent = f.filter((x) => x[1] === 1).reduce((s, x) => s + x[2], 0);
        const back = f.filter((x) => x[1] === 2).reduce((s, x) => s + x[2], 0);
        const pnl = spent > 0 ? ((value + back - spent) / spent) * 100 : 0;
        return (
          <button key={ci} className="pos-row" style={{ width: "100%", background: "none", border: 0, textAlign: "left" }} onClick={() => onPick(ci)}>
            <CoinIcon nm={nm} size={22} />
            <b>${nm?.ticker}</b>
            <span className="mono">{sol(value, 2)}</span>
            <span className={`mono t-${tone(pnl)}`} style={{ minWidth: 58, textAlign: "right" }}>
              {pct(pnl, 0)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Standings({
  info,
  board,
  roster,
  aliveRows,
  meSlot,
  keep,
}: {
  info: MatchInfo;
  board: Board | null;
  roster: Map<number, RosterRow>;
  aliveRows: [number, number, number, number | null, number | null][];
  meSlot: number | null;
  keep: number | null;
}) {
  const top = aliveRows.slice(0, 8);
  const myIdx = meSlot == null ? -1 : aliveRows.findIndex((r) => r[0] === meSlot);
  const extra = myIdx >= 8 ? [aliveRows[myIdx]] : [];
  return (
    <div className="panel standings">
      <div className="panel-head">
        <span className="lbl">Standings</span>
        <span className="dim small">
          {board?.alive ?? info.size}/{info.size} alive
        </span>
      </div>
      {[...top, ...extra].map((r) => {
        const rank = aliveRows.indexOf(r) + 1;
        const p = roster.get(r[0]);
        const cut = keep != null && rank === keep + 1;
        return (
          <div key={r[0]} className={`row ${r[0] === meSlot ? "me" : ""} ${cut ? "cutline" : ""}`}>
            <span className="mono dim">#{rank}</span>
            <Avatar look={p?.[2]} size={20} />
            <span className="nm">
              {p?.[1] ?? "…"}
              {p?.[3] && <span className="chip chip-ai">AI</span>}
            </span>
            <span className={`mono t-${tone(r[1] - info.start_sol)}`}>{sol(r[1])}</span>
          </div>
        );
      })}
      {keep != null && <p className="dim small" style={{ marginTop: 8 }}>Top {keep} survive the next cut.</p>}
    </div>
  );
}

function KillFeed({ board, roster, names }: { board: Board | null; roster: Map<number, RosterRow>; names: Map<number, Codename> }) {
  const items = (board?.feed ?? []).slice(0, 7);
  if (!items.length) return null;
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="lbl">Live feed</span>
      </div>
      <div className="killfeed">
        {items.map((f) => {
          const p = roster.get(f[0]);
          const nm = names.get(f[1]);
          return (
            <div key={`${f[0]}-${f[4]}-${f[1]}-${f[2]}`} className="k">
              <Avatar look={p?.[2]} size={16} />
              <b>{p?.[1] ?? "trader"}</b>
              <span className={f[2] === 1 ? "t-up" : "t-down"}>{f[2] === 1 ? "bought" : "sold"}</span>
              <span className="mono">{sol(f[3], 2)} SOL</span>
              <span className="dim">${nm?.ticker}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
