"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rpc } from "@/lib/supabase";
import { bag, EMOTES, flags, ghostBag, OUTCOME, RoundCoin, type Tr } from "@/lib/duel";
import { codename, type Codename } from "@/lib/codename";
import { age, clock, pct, signed, sol, tone, usd } from "@/lib/format";
import { centerOf, confetti, edgeGlow, floatText, sfx, toast } from "@/lib/fx";
import { tier } from "@/lib/rank";
import { SITE_URL } from "@/lib/config";
import type { DuelFill, DuelPlayer, DuelRound, DuelState, FeedRow } from "@/lib/types";
import { useApp } from "./AppProvider";
import Avatar from "./Avatar";
import CoinIcon from "./CoinIcon";
import DuelChart, { type Mark } from "./DuelChart";

const BUY = [0.5, 1, 2, 5];
const SELL = [25, 50, 75, 100];
const BUY_KEYS = ["q", "w", "e", "r"];
const SELL_KEYS = ["a", "s", "d", "f"];

type Phase = "loading" | "queue" | "cancelled" | "vs" | "round" | "break" | "final";

export default function Duel({ id }: { id: string }) {
  const router = useRouter();
  const { session, refreshMe } = useApp();
  const [st, setSt] = useState<DuelState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const skew = useRef(0);
  const [now, setNow] = useState(() => Date.now());
  const coins = useRef(new Map<number, RoundCoin>());
  const since = useRef(new Map<number, number>());
  const [ver, setVer] = useState(0);
  const [local, setLocal] = useState<DuelFill[]>([]);
  const [bubbles, setBubbles] = useState<{ key: string; slot: number; e: number }[]>([]);
  const seenEmotes = useRef(new Set<string>());
  const seenOpp = useRef(new Set<string>());

  const pull = useCallback(async () => {
    const t0 = Date.now();
    try {
      const d = await rpc<DuelState>("yr_duel", { p_duel: id, p_secret: session?.secret ?? null });
      skew.current = d.now - (t0 + Date.now()) / 2;
      for (const r of d.rs) if (!coins.current.has(r.r)) coins.current.set(r.r, new RoundCoin(r.off, r.sol_usd));
      setSt(d);
      setLocal((l) => l.filter((f) => !d.fills.some((x) => x[0] === f[0] && x[1] === f[1] && x[2] === f[2] && x[3] === f[3])));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load the duel");
    }
  }, [id, session]);

  useEffect(() => {
    void pull();
  }, [pull]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  // ---- clock & phase ----
  const sNow = now + skew.current;
  const per = st ? st.round_ms + st.gap_ms : 1;
  const rel = st?.start != null ? sNow - st.start : -1;
  const lastPlayed = st ? Math.max(-1, ...st.rs.filter((r) => r.win != null).map((r) => r.r)) : -1;
  let phase: Phase = "loading";
  let cur = 0;
  let within = 0;
  if (st) {
    if (st.status === "cancelled") phase = "cancelled";
    else if (st.status === "queue" || st.start == null) phase = "queue";
    else if (rel < 0) phase = "vs";
    else {
      const r = Math.floor(rel / per);
      within = rel - r * per;
      if (st.status === "done") {
        const endPlayed = st.start + (lastPlayed + 1) * per - st.gap_ms;
        if (sNow >= endPlayed + 4500) phase = "final";
        else if (r <= lastPlayed && within < st.round_ms) {
          phase = "round";
          cur = r;
        } else {
          phase = "break";
          cur = Math.max(0, lastPlayed);
          within = st.round_ms + Math.max(0, sNow - endPlayed);
        }
      } else if (r >= st.rounds) {
        phase = "break";
        cur = st.rounds - 1;
        within = st.round_ms;
      } else {
        cur = r;
        phase = within < st.round_ms ? "round" : "break";
      }
    }
  }

  // poll faster while playing
  useEffect(() => {
    if (!st) return;
    const ms = phase === "final" || phase === "cancelled" ? 6000 : phase === "queue" ? 900 : 1000;
    const t = setInterval(pull, ms);
    return () => clearInterval(t);
  }, [st, phase, pull]);

  // ---- market feed of the current round ----
  const live = phase === "round" || phase === "break";
  useEffect(() => {
    if (!st || !live) return;
    let dead = false;
    let timer: ReturnType<typeof setTimeout>;
    const r = cur;
    const pullFeed = async () => {
      const coin = coins.current.get(r);
      if (!coin) {
        timer = setTimeout(pullFeed, 500);
        return;
      }
      try {
        const f = await rpc<{ ct: number | null; ev: FeedRow[]; more: boolean }>("yr_duel_feed", { p_duel: id, p_r: r, p_since: since.current.get(r) ?? 0 });
        if (dead) return;
        const fresh = coin.add(f.ev);
        if (f.ev.length) since.current.set(r, f.ev[f.ev.length - 1][0]);
        if (fresh.length) setVer((v) => v + 1);
        timer = setTimeout(pullFeed, f.more ? 60 : phase === "break" ? 3000 : 700);
      } catch {
        timer = setTimeout(pullFeed, 1500);
      }
    };
    void pullFeed();
    return () => {
      dead = true;
      clearTimeout(timer);
    };
  }, [st?.id, live, cur, id, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- sides ----
  const mySlot = st?.me ?? 1;
  const oppSlot = 3 - mySlot;
  const meP = st ? (mySlot === 1 ? st.p1 : st.p2) : null;
  const oppP = st ? (mySlot === 1 ? st.p2 : st.p1) : null;
  const isGhostOpp = !!st?.ghost && oppSlot === 2;
  const round: DuelRound | undefined = st?.rs.find((r) => r.r === cur);
  const coin = coins.current.get(cur) ?? null;
  const nm = useMemo(() => codename(`${id}:${cur}`, 0), [id, cur]);
  const price = coin?.price() ?? 0;
  const fills = useMemo(() => [...(st?.fills ?? []), ...local], [st?.fills, local]);
  const mine = bag(fills, mySlot, cur, price);
  const ghost = coin && isGhostOpp && round?.gw != null && round.gs != null ? ghostBag(coin, round.gw, round.gs, price) : null;
  const opp = ghost ?? bag(fills, oppSlot, cur, price);
  const ct = round ? round.off + Math.max(0, Math.min(within, st!.round_ms)) * st!.speed : 0;
  const canTrade = !!session && st?.me != null && phase === "round" && st.status === "live";
  const myWins = st ? st.rs.filter((r) => r.win === mySlot).length : 0;
  const oppWins = st ? st.rs.filter((r) => r.win === oppSlot).length : 0;

  // ---- opponent moves: a toast and a tick for each fresh trade ----
  useEffect(() => {
    if (!st || phase !== "round" || !oppP) return;
    const items: { key: string; k: number; sol: number; fresh: boolean }[] = ghost
      ? ghost.trades.map((t: Tr) => ({ key: `g${cur}:${t.seq}`, k: t.k, sol: t.sol * (round?.gs ?? 1), fresh: t.t >= ct - 8000 * st.speed }))
      : st.fills
          .filter((f) => f[0] === oppSlot && f[1] === cur)
          .map((f) => ({ key: `f${f[1]}:${f[2]}:${f[3]}`, k: f[3], sol: f[4], fresh: f[2] >= within - 8000 }));
    for (const it of items) {
      if (seenOpp.current.has(it.key)) continue;
      seenOpp.current.add(it.key);
      if (!it.fresh) continue;
      sfx.tick();
      toast(`${oppP.name} ${it.k === 1 ? "bought" : "sold"} ${sol(it.sol, 2)} SOL`, it.k === 1 ? "up" : "down");
    }
  }, [ver, st, phase, cur]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- round results ----
  const roundSeen = useRef(new Set<number>());
  useEffect(() => {
    if (!st) return;
    for (const r of st.rs) {
      if (r.win == null || roundSeen.current.has(r.r)) continue;
      roundSeen.current.add(r.r);
      if (sNow - (st.start ?? 0) - r.r * per > st.round_ms + 15_000) continue; // old news on reload
      if (r.win === mySlot) {
        sfx.rank();
        confetti();
        edgeGlow("up");
      } else if (r.win === oppSlot) {
        sfx.lose();
        edgeGlow("down");
      } else sfx.tick();
    }
  }, [st]); // eslint-disable-line react-hooks/exhaustive-deps

  const finalSeen = useRef(false);
  useEffect(() => {
    if (phase !== "final" || finalSeen.current || !st) return;
    finalSeen.current = true;
    void refreshMe();
    if (st.winner === mySlot) {
      sfx.win();
      confetti();
      setTimeout(() => confetti(), 450);
    } else if (st.winner === oppSlot) sfx.lose();
  }, [phase, st, mySlot, oppSlot, refreshMe]);

  // ---- emotes ----
  useEffect(() => {
    if (!st) return;
    for (const [slot, e, at] of st.emotes) {
      const key = `${slot}:${e}:${at}`;
      if (seenEmotes.current.has(key)) continue;
      seenEmotes.current.add(key);
      if (sNow - at > 6000) continue;
      setBubbles((b) => [...b, { key, slot, e }]);
      setTimeout(() => setBubbles((b) => b.filter((x) => x.key !== key)), 3200);
    }
  }, [st]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendEmote = useCallback(
    async (e: number) => {
      if (!session || !st?.me) return;
      const key = `${st.me}:${e}:local${Date.now()}`;
      setBubbles((b) => [...b, { key, slot: st.me!, e }]);
      setTimeout(() => setBubbles((b) => b.filter((x) => x.key !== key)), 3200);
      try {
        await rpc("yr_duel_emote", { p_secret: session.secret, p_duel: id, p_e: e });
      } catch {
        /* ignore */
      }
    },
    [session, st, id],
  );

  // ---- trading ----
  const [busy, setBusy] = useState(false);
  const trade = useCallback(
    async (side: "buy" | "sell", amount: number, el?: Element | null) => {
      if (!session || !canTrade || busy) return;
      if (side === "buy" && amount > mine.cash + 1e-9) {
        sfx.error();
        toast("Not enough SOL", "down");
        return;
      }
      if (side === "sell" && amount <= 0) return;
      setBusy(true);
      try {
        const r = await rpc<{ r: number; t: number; sol: number; tok: number; cash: number; held: number }>("yr_duel_trade", {
          p_secret: session.secret,
          p_duel: id,
          p_side: side,
          p_amount: amount,
        });
        setLocal((l) => [...l, [mySlot, r.r, r.t, side === "buy" ? 1 : 2, r.sol, r.tok]]);
        const { x, y } = centerOf(el ?? null);
        if (side === "buy") {
          sfx.buy();
          floatText(`+${sol(r.sol, 2)} SOL in`, x, y - 26, "up");
        } else {
          const cost = mine.avgPx != null ? mine.avgPx * r.tok : r.sol;
          const gain = r.sol - cost;
          if (gain >= 0) {
            sfx.win();
            confetti(x, y);
          } else sfx.lose();
          floatText(`${signed(gain, 2)} SOL`, x, y - 26, gain >= 0 ? "up" : "down");
        }
        void pull();
      } catch (e) {
        sfx.error();
        toast(e instanceof Error ? e.message : "Trade failed", "down");
      } finally {
        setBusy(false);
      }
    },
    [session, canTrade, busy, mine.cash, mine.avgPx, id, mySlot, pull],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea")) return;
      const k = e.key.toLowerCase();
      const bi = BUY_KEYS.indexOf(k);
      const si = SELL_KEYS.indexOf(k);
      if (bi >= 0) void trade("buy", BUY[bi], document.querySelector(`[data-hk="${k}"]`));
      else if (si >= 0 && mine.held > 0) {
        const p = SELL[si];
        void trade("sell", p >= 100 ? mine.held : (mine.held * p) / 100, document.querySelector(`[data-hk="${k}"]`));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trade, mine.held]);

  // ---- render ----
  if (err) {
    return (
      <main className="center">
        <div>
          <p className="err">{err}</p>
          <Link href="/" className="btn btn-primary" style={{ marginTop: 14 }}>
            Back to the arena
          </Link>
        </div>
      </main>
    );
  }
  if (!st || phase === "loading") {
    return (
      <main className="center">
        <i className="spinner" />
      </main>
    );
  }
  if (phase === "queue" || phase === "cancelled") {
    return (
      <main className="center">
        <div className="panel" style={{ padding: 24, minWidth: 300 }}>
          {phase === "queue" ? (
            <>
              <span className="spin-ring big" />
              <p className="display" style={{ fontSize: 16, marginTop: 14 }}>
                Finding your opponent…
              </p>
              <p className="muted small" style={{ marginTop: 6 }}>
                A ghost steps in after a few seconds.
              </p>
            </>
          ) : (
            <p className="display" style={{ fontSize: 16 }}>
              This duel was cancelled.
            </p>
          )}
          <Link href="/" className="btn" style={{ marginTop: 16 }}>
            Back to the arena
          </Link>
        </div>
      </main>
    );
  }
  if (phase === "vs" && meP && oppP) return <VsScreen st={st} left={meP} right={oppP} leftSlot={mySlot} ms={-rel} />;

  const myPnl = mine.eq - 10;
  const oppPnl = opp.eq - 10;
  const intel = coin && coin.trades.length ? coin.intel(ct) : null;
  const marks: Mark[] = [
    ...fills.filter((f) => f[1] === cur && (f[0] === mySlot || (!isGhostOpp && f[0] === oppSlot))).map((f) => ({
      t: (round?.off ?? 0) + f[2] * st.speed,
      k: f[3],
      who: (f[0] === mySlot ? "me" : "opp") as Mark["who"],
    })),
    ...(ghost?.trades ?? []).map((t) => ({ t: t.t, k: t.k, who: "opp" as const })),
  ];
  const entryUsd = mine.held > 0 && mine.avgPx != null && coin ? mine.avgPx * 1e9 * coin.solUsd : null;
  const left = round ? st.round_ms - within : 0;

  return (
    <>
      <div className="world duel-world" />
      {phase === "round" && left < 10_000 && <div className={`clock-vignette ${myPnl >= oppPnl ? "ahead" : "behind"}`} />}
      <main className="duel">
        <header className="duel-top">
          <SideTag p={meP} you={st.me != null} side="left" eq={mine.eq} wins={myWins} bubbles={bubbles.filter((b) => b.slot === mySlot)} ghost={false} />
          <div className="duel-center">
            <div className="pips">
              {Array.from({ length: st.rounds }, (_, i) => {
                const r = st.rs.find((x) => x.r === i);
                const cls = r?.win == null ? (i === cur && phase === "round" ? "live" : "") : r.win === mySlot ? "won" : r.win === oppSlot ? "lost" : "draw";
                return (
                  <span key={i} className={`pip ${cls}`}>
                    R{i + 1}
                  </span>
                );
              })}
            </div>
            <div className={`round-clock mono ${phase === "round" && left < 10_000 ? "hot" : ""}`}>
              {phase === "round" ? clock(left) : st.status === "done" ? "FINAL" : clock(per - within)}
            </div>
            <div className="round-sub">{phase === "round" ? `Round ${cur + 1} of ${st.rounds}` : st.status === "done" ? "Duel over" : `Round ${cur + 2} next`}</div>
          </div>
          <SideTag
            p={oppP}
            you={false}
            side="right"
            eq={opp.eq}
            wins={oppWins}
            bubbles={bubbles.filter((b) => b.slot === oppSlot)}
            ghost={isGhostOpp}
          />
          <TugBar a={mine.eq} b={opp.eq} />
        </header>

        <section className="duel-body">
          <aside className="duel-left">
            <BagCard title={st.me != null ? "Your bag" : meP?.name ?? "Player 1"} b={mine} pnl={myPnl} coin={coin} mineSide />
            {st.me != null ? (
              <TradePanel coin={coin} cash={mine.cash} held={mine.held} canTrade={canTrade} busy={busy} onTrade={trade} ticker={nm.ticker} phase={phase} />
            ) : (
              <div className="panel muted small">You are watching this duel.</div>
            )}
            {st.me != null && (
              <div className="panel emote-bar">
                <span className="lbl">Say something</span>
                <div className="emotes">
                  {EMOTES.map((e, i) => (
                    <button key={e} onClick={() => sendEmote(i)}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <section className="duel-main">
            <div className="panel p-chart">
              <CoinHead nm={nm} round={round} intel={intel} ct={ct} />
              {coin ? <DuelChart coin={coin} version={ver} marks={marks} entryUsd={entryUsd} /> : <div className="chart-box" />}
            </div>
            {intel && (
              <div className="panel p-intel">
                <div className="intel">
                  <Cell label="Holders" v={String(intel.holders)} />
                  <Cell label="Top 10" v={`${intel.top10.toFixed(1)}%`} cls={intel.top10 >= 45 ? "t-down" : intel.top10 >= 30 ? "t-warn" : "t-up"} />
                  <Cell label="Dev holds" v={`${intel.dev.toFixed(1)}%`} cls={intel.devSold ? "t-down" : intel.dev >= 10 ? "t-warn" : ""} />
                  <Cell label="Snipers" v={`${intel.snipers.toFixed(1)}%`} cls={intel.snipers >= 25 ? "t-down" : intel.snipers >= 12 ? "t-warn" : ""} />
                  <Cell
                    label="Buys / sells 1m"
                    v={
                      <>
                        <span className="t-up">{intel.buys}</span> / <span className="t-down">{intel.sells}</span>
                      </>
                    }
                  />
                  <Cell label="Volume 1m" v={`${sol(intel.buyVol + intel.sellVol, 1)} SOL`} />
                  <Cell label="Bonding" v={`${intel.progress.toFixed(0)}%`} bar={intel.progress} />
                  <Cell label="Trades" v={String(intel.txs)} />
                </div>
                <div className="flags">
                  {flags(intel).map((f) => (
                    <span key={f.text} className={`chip chip-${f.tone}`}>
                      {f.tone === "up" ? "✓" : f.tone === "down" ? "✕" : "!"} {f.text}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="duel-right">
            <BagCard title={isGhostOpp ? "Ghost's bag" : `${oppP?.name ?? "Opponent"}'s bag`} b={opp} pnl={oppPnl} coin={coin} />
            {isGhostOpp && (
              <div className="panel ghost-note">
                <span className="chip chip-ghost">GHOST</span>
                <p className="small muted">
                  Replays the real trades of wallet #{round?.gw ?? "?"} on this coin, scaled to a 10 SOL bag. Real trader, real timing.
                </p>
              </div>
            )}
            <OppMoves
              items={
                ghost
                  ? ghost.trades.map((t) => ({ k: t.k, sol: t.sol * (round?.gs ?? 1), at: t.t, mc: t.mc * (coin?.solUsd ?? 150) }))
                  : fills
                      .filter((f) => f[0] === oppSlot && f[1] === cur)
                      .map((f) => ({ k: f[3], sol: f[4], at: (round?.off ?? 0) + f[2] * st.speed, mc: null }))
              }
            />
            <RoundLog st={st} mySlot={mySlot} id={id} />
          </aside>
        </section>
      </main>

      {phase === "break" && round && <RoundBreak st={st} round={round} mySlot={mySlot} nm={nm} next={per - within} />}
      {phase === "final" && <Final st={st} mySlot={mySlot} id={id} />}
    </>
  );
}

// ---------- pieces ----------

function SideTag({
  p,
  you,
  side,
  eq,
  wins,
  bubbles,
  ghost,
}: {
  p: DuelPlayer | null;
  you: boolean;
  side: "left" | "right";
  eq: number;
  wins: number;
  bubbles: { key: string; e: number }[];
  ghost: boolean;
}) {
  const t = tier(p?.elo ?? 1000);
  return (
    <div className={`side-tag ${side}`}>
      <div className="st-av">
        <Avatar look={p?.avatar} size={44} />
        {bubbles.map((b) => (
          <span key={b.key} className="bubble">
            {EMOTES[b.e]}
          </span>
        ))}
      </div>
      <div className="st-meta">
        <b>
          {p?.name ?? "…"}
          {you && <span className="chip chip-you">YOU</span>}
          {ghost && <span className="chip chip-ghost">GHOST</span>}
        </b>
        <span className="mono small" style={{ color: t.color }}>
          {t.name} · {p?.elo ?? "—"}
        </span>
      </div>
      <div className="st-eq">
        <span className={`mono t-${tone(eq - 10)}`}>{sol(eq)}</span>
        <span className="lbl">SOL</span>
      </div>
      <div className="st-wins mono">{wins}</div>
    </div>
  );
}

function TugBar({ a, b }: { a: number; b: number }) {
  const pa = Math.max(0.0001, a);
  const pb = Math.max(0.0001, b);
  const share = Math.max(4, Math.min(96, (pa / (pa + pb)) * 100));
  const lead = a - b;
  return (
    <div className="tug" aria-label="Who is ahead">
      <div className="tug-a" style={{ width: `${share}%` }} />
      <div className="tug-b" style={{ width: `${100 - share}%` }} />
      <div className="tug-knot" style={{ left: `${share}%` }} />
      <span className={`tug-label mono ${lead >= 0 ? "t-up" : "t-down"}`}>
        {Math.abs(lead) < 0.005 ? "Even" : `${lead > 0 ? "You lead" : "Behind"} ${sol(Math.abs(lead), 2)} SOL`}
      </span>
    </div>
  );
}

function BagCard({ title, b, pnl, coin, mineSide }: { title: string; b: { eq: number; cash: number; held: number; n: number }; pnl: number; coin: RoundCoin | null; mineSide?: boolean }) {
  const value = b.held * (coin?.price() ?? 0);
  return (
    <div className={`panel bag ${mineSide ? "mine" : "theirs"}`}>
      <div className="panel-head">
        <span className="lbl">{title}</span>
        <span className="small dim">{b.n} trades</span>
      </div>
      <div className={`bag-eq mono t-${tone(pnl)}`}>{sol(b.eq)} SOL</div>
      <div className={`mono small t-${tone(pnl)}`}>
        {signed(pnl, 2)} SOL · {pct((pnl / 10) * 100, 1)}
      </div>
      <div className="bag-split">
        <div>
          <span className="lbl">Cash</span>
          <b className="mono">{sol(b.cash)}</b>
        </div>
        <div>
          <span className="lbl">In the coin</span>
          <b className="mono">{sol(value)}</b>
        </div>
      </div>
    </div>
  );
}

function TradePanel({
  coin,
  cash,
  held,
  canTrade,
  busy,
  onTrade,
  ticker,
  phase,
}: {
  coin: RoundCoin | null;
  cash: number;
  held: number;
  canTrade: boolean;
  busy: boolean;
  onTrade: (side: "buy" | "sell", amount: number, el?: Element | null) => void;
  ticker: string;
  phase: Phase;
}) {
  const [custom, setCustom] = useState("");
  const v = Math.max(0, parseFloat(custom.replace(",", ".")) || 0);
  const q = coin && v > 0 ? coin.quote("buy", v) : null;
  const dis = !canTrade || busy;
  return (
    <div className="panel trade">
      <div className="panel-head">
        <span className="lbl">Trade ${ticker}</span>
        <span className="small dim">{phase === "round" ? "hotkeys on" : "between rounds"}</span>
      </div>
      <span className="lbl sub">Buy (SOL)</span>
      <div className="tgrid">
        {BUY.map((a, i) => (
          <button key={a} data-hk={BUY_KEYS[i]} className="tbtn buy" disabled={dis || a > cash + 1e-9} onClick={(e) => onTrade("buy", a, e.currentTarget)}>
            {a}
            <kbd>{BUY_KEYS[i].toUpperCase()}</kbd>
          </button>
        ))}
      </div>
      <div className="custom">
        <input className="input mono" inputMode="decimal" placeholder="Custom SOL" value={custom} onChange={(e) => setCustom(e.target.value)} />
        <button className="btn btn-buy btn-sm" disabled={dis || v < 0.05 || v > cash + 1e-9} onClick={(e) => onTrade("buy", v, e.currentTarget)}>
          Buy
        </button>
      </div>
      {q && <div className="small dim mono">≈ {(q.tok / 1e6).toFixed(2)}M · impact {q.impact.toFixed(1)}%</div>}
      <span className="lbl sub">Sell (% of bag)</span>
      <div className="tgrid">
        {SELL.map((p, i) => (
          <button
            key={p}
            data-hk={SELL_KEYS[i]}
            className="tbtn sell"
            disabled={dis || held <= 0}
            onClick={(e) => onTrade("sell", p >= 100 ? held : (held * p) / 100, e.currentTarget)}
          >
            {p}%<kbd>{SELL_KEYS[i].toUpperCase()}</kbd>
          </button>
        ))}
      </div>
      <div className="trade-foot small dim mono">
        <span>Cash {sol(cash)} SOL</span>
        <span>1% fee · real curve</span>
      </div>
    </div>
  );
}

function CoinHead({ nm, round, intel, ct }: { nm: Codename; round: DuelRound | undefined; intel: ReturnType<RoundCoin["intel"]> | null; ct: number }) {
  return (
    <div className="coin-head">
      <CoinIcon nm={nm} size={38} />
      <div style={{ minWidth: 0 }}>
        <h2>{nm.name}</h2>
        <div className="chips">
          <span className="chip mono">${nm.ticker}</span>
          <span className="chip mono">age {age(ct)}</span>
          {round?.x && <span className="chip">𝕏</span>}
          {round?.tg && <span className="chip">Telegram</span>}
          {round?.web && <span className="chip">Website</span>}
          {round && !round.x && !round.tg && !round.web && <span className="chip chip-warn">No socials</span>}
        </div>
      </div>
      <div className="mc">
        <span className="lbl">Market cap</span>
        <b className={`mono t-${tone(intel?.chg ?? 0)}`}>{intel ? usd(intel.mcUsd) : "—"}</b>
        <span className="mono small muted">{intel ? `${pct(intel.chg, 0)} from launch · ATH ${usd(intel.athUsd)}` : "waiting for trades"}</span>
      </div>
    </div>
  );
}

function Cell({ label, v, cls, bar }: { label: string; v: React.ReactNode; cls?: string; bar?: number }) {
  return (
    <div className="cell">
      <span className="lbl">{label}</span>
      <b className={`mono ${cls ?? ""}`}>{v}</b>
      {bar != null && (
        <div className="progress">
          <i style={{ width: `${bar}%` }} />
        </div>
      )}
    </div>
  );
}

function OppMoves({ items }: { items: { k: number; sol: number; at: number; mc: number | null }[] }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="lbl">Opponent moves</span>
        <span className="small dim">{items.length}</span>
      </div>
      <div className="moves">
        {[...items].reverse().slice(0, 8).map((m, i) => (
          <div key={`${m.at}-${i}`} className={`move ${m.k === 1 ? "b" : "s"}`}>
            <span className="mono">{m.k === 1 ? "BUY" : "SELL"}</span>
            <b className="mono">{sol(m.sol, 2)} SOL</b>
            <span className="mono dim">{m.mc ? usd(m.mc) : ""}</span>
            <span className="mono dim">{clock(m.at)}</span>
          </div>
        ))}
        {!items.length && <p className="small dim">No moves yet. Watch closely.</p>}
      </div>
    </div>
  );
}

function RoundLog({ st, mySlot, id }: { st: DuelState; mySlot: number; id: string }) {
  const done = st.rs.filter((r) => r.win != null);
  if (!done.length) return null;
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="lbl">Rounds</span>
      </div>
      {done.map((r) => {
        const n = codename(`${id}:${r.r}`, 0);
        const my = mySlot === 1 ? r.eq1 : r.eq2;
        const th = mySlot === 1 ? r.eq2 : r.eq1;
        const o = OUTCOME[r.reveal?.outcome ?? "mid"] ?? OUTCOME.mid;
        return (
          <div key={r.r} className="rlog">
            <span className={`pip ${r.win === mySlot ? "won" : r.win === 0 ? "draw" : "lost"}`}>R{r.r + 1}</span>
            <span className="small" style={{ minWidth: 0 }}>
              ${n.ticker} was <b>${r.reveal?.symbol ?? "?"}</b> <span className={o.cls}>· {o.label}</span>
            </span>
            <span className="mono small">
              {sol(my ?? 10)} / {sol(th ?? 10)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function VsScreen({ st, left, right, leftSlot, ms }: { st: DuelState; left: DuelPlayer; right: DuelPlayer; leftSlot: number; ms: number }) {
  const sec = Math.ceil(ms / 1000);
  const last = useRef(-1);
  useEffect(() => {
    if (sec !== last.current && sec <= 3 && sec > 0) sfx.tick();
    last.current = sec;
  }, [sec]);
  const tl = tier(left.elo);
  const tr = tier(right.elo);
  const ghostRight = st.ghost && leftSlot === 1;
  return (
    <main className="vs">
      <div className="vs-side l">
        <div className="vs-glow" />
        <Avatar look={left.avatar} size={150} />
        <b className="vs-name">{left.name}</b>
        <span className="mono" style={{ color: tl.color }}>
          {tl.name} · {left.elo}
        </span>
        <span className="mono small muted">
          {left.w ?? 0}W – {left.l ?? 0}L{(left.streak ?? 0) >= 2 ? ` · 🔥${left.streak}` : ""}
        </span>
      </div>
      <div className="vs-mid">
        <span className="vs-word">VS</span>
        <span key={sec} className="vs-count mono">
          {Math.max(1, sec)}
        </span>
        <span className="small muted">Best of 3 · 75 s rounds · 10 play SOL each</span>
      </div>
      <div className="vs-side r">
        <div className="vs-glow" />
        <Avatar look={right.avatar} size={150} />
        <b className="vs-name">
          {right.name}
          {ghostRight && <span className="chip chip-ghost">GHOST</span>}
        </b>
        <span className="mono" style={{ color: tr.color }}>
          {ghostRight ? `Replays real wallets · ${right.elo}` : `${tr.name} · ${right.elo}`}
        </span>
        {!ghostRight && (
          <span className="mono small muted">
            {right.w ?? 0}W – {right.l ?? 0}L
          </span>
        )}
      </div>
    </main>
  );
}

function RoundBreak({ st, round, mySlot, nm, next }: { st: DuelState; round: DuelRound; mySlot: number; nm: Codename; next: number }) {
  const my = mySlot === 1 ? round.eq1 : round.eq2;
  const th = mySlot === 1 ? round.eq2 : round.eq1;
  const res = round.win == null ? null : round.win === mySlot ? "win" : round.win === 0 ? "draw" : "loss";
  const o = OUTCOME[round.reveal?.outcome ?? "mid"] ?? OUTCOME.mid;
  const spectator = st.me == null;
  return (
    <div className="break-back">
      <div className={`break-card ${res ?? ""}`}>
        <span className="lbl">Round {round.r + 1}</span>
        <h2 className="break-title">
          {res == null ? "Settling the round…" : res === "win" ? (spectator ? `${st.p1.name} takes it` : "Round won") : res === "draw" ? "Draw" : spectator ? `${st.p2?.name} takes it` : "Round lost"}
        </h2>
        {res != null && (
          <div className="break-eq mono">
            <span className={tone((my ?? 10) - 10) === "down" ? "t-down" : "t-up"}>{sol(my ?? 10)}</span>
            <i>vs</i>
            <span className={tone((th ?? 10) - 10) === "down" ? "t-down" : "t-up"}>{sol(th ?? 10)}</span>
          </div>
        )}
        {round.reveal && (
          <div className="reveal">
            <CoinIcon nm={nm} size={34} />
            <div style={{ minWidth: 0 }}>
              <span className="small dim">${nm.ticker} was really</span>
              <b>
                {round.reveal.name} (${round.reveal.symbol})
              </b>
              <span className="small muted">{round.reveal.note}</span>
            </div>
            <span className={`outcome ${o.cls}`}>{o.label}</span>
          </div>
        )}
        {round.reveal?.mint && (
          <a className="small muted" href={`https://pump.fun/coin/${round.reveal.mint}`} target="_blank" rel="noreferrer">
            See the real coin on pump.fun ↗
          </a>
        )}
        <div className="break-next mono">{st.status === "done" ? "Final result coming up…" : `Round ${round.r + 2} in ${Math.max(0, Math.ceil(next / 1000))}`}</div>
      </div>
    </div>
  );
}

function Final({ st, mySlot, id }: { st: DuelState; mySlot: number; id: string }) {
  const router = useRouter();
  const { session, me } = useApp();
  const spectator = st.me == null;
  const won = st.winner === mySlot;
  const draw = st.winner === 0;
  const s = st.score;
  const mine = mySlot === 1 ? s[0] ?? 0 : s[1] ?? 0;
  const theirs = mySlot === 1 ? s[1] ?? 0 : s[0] ?? 0;
  const delta = mySlot === 1 ? st.elo[0] : st.elo[1];
  const opp = mySlot === 1 ? st.p2 : st.p1;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (delta == null) return;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setShown(Math.round((delta * i) / 20));
      if (i >= 20) clearInterval(t);
    }, 40);
    return () => clearInterval(t);
  }, [delta]);
  const [busy, setBusy] = useState(false);
  const again = async () => {
    if (!session) return router.push("/");
    setBusy(true);
    try {
      const r = await rpc<{ id: string; status: string }>("yr_duel_find", { p_secret: session.secret });
      router.push(r.status === "live" ? `/duel/${r.id}` : `/?find=${r.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not find a match", "down");
      setBusy(false);
    }
  };
  const share = `${won ? "Won" : draw ? "Drew" : "Lost"} a 1v1 trading duel ${mine}-${theirs} on yeppo. Same real pump.fun coin, best of 3. 1v1 me.`;
  const t = tier(me?.elo ?? 1000);
  return (
    <div className="final-back">
      <div className={`final ${won ? "win" : draw ? "draw" : "loss"}`}>
        <span className="lbl">{spectator ? "Duel over" : st.ghost ? "Ranked duel · vs ghost" : "Ranked duel"}</span>
        <h1 className="final-title">{spectator ? `${st.winner === 1 ? st.p1.name : st.winner === 2 ? st.p2?.name : "Nobody"} wins` : won ? "Victory" : draw ? "Draw" : "Defeat"}</h1>
        <div className="final-score mono">
          <span className={won ? "t-up" : ""}>{mine}</span>
          <i>–</i>
          <span className={!won && !draw ? "t-down" : ""}>{theirs}</span>
        </div>
        {!spectator && (
          <div className="final-stats">
            <div>
              <span className="lbl">Rating</span>
              <b className={`mono ${(delta ?? 0) >= 0 ? "t-up" : "t-down"}`}>{signed(shown, 0)}</b>
              <span className="small muted mono">
                {me ? `${me.elo} · ` : ""}
                <span style={{ color: t.color }}>{t.name}</span>
              </span>
            </div>
            <div>
              <span className="lbl">Streak</span>
              <b className="mono">{me?.streak ? `🔥 ${me.streak}` : "0"}</b>
              <span className="small muted">best {me?.best_streak ?? 0}</span>
            </div>
            <div>
              <span className="lbl">Opponent</span>
              <b className="opp-name">
                <Avatar look={opp?.avatar} size={20} /> {opp?.name}
              </b>
              <span className="small muted mono">{st.ghost ? "ghost of real wallets" : `${opp?.elo ?? ""} rating`}</span>
            </div>
          </div>
        )}
        <div className="final-rounds">
          {st.rs
            .filter((r) => r.win != null)
            .map((r) => {
              const n = codename(`${id}:${r.r}`, 0);
              const o = OUTCOME[r.reveal?.outcome ?? "mid"] ?? OUTCOME.mid;
              const my = mySlot === 1 ? r.eq1 : r.eq2;
              const th = mySlot === 1 ? r.eq2 : r.eq1;
              return (
                <div key={r.r} className={`fr ${r.win === mySlot ? "won" : r.win === 0 ? "draw" : "lost"}`}>
                  <span className="lbl">Round {r.r + 1}</span>
                  <b>${r.reveal?.symbol ?? n.ticker}</b>
                  <span className={`small ${o.cls}`}>{o.label}</span>
                  <span className="mono small">
                    {sol(my ?? 10)} vs {sol(th ?? 10)}
                  </span>
                </div>
              );
            })}
        </div>
        <div className="final-actions">
          <button className="btn btn-primary big" onClick={again} disabled={busy}>
            {busy ? "Finding…" : "Play again"}
          </button>
          <a
            className="btn big"
            href={`https://x.com/intent/post?text=${encodeURIComponent(share)}&url=${encodeURIComponent(`${SITE_URL}/duel/${id}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            Share on 𝕏
          </a>
          <Link href="/" className="btn btn-ghost big">
            Arena
          </Link>
        </div>
      </div>
    </div>
  );
}
