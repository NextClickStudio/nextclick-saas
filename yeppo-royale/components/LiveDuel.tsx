"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rpc } from "@/lib/supabase";
import { clock, pct, signed, sol, tone, usd } from "@/lib/format";
import { confetti, edgeGlow, sfx, toast } from "@/lib/fx";
import { tier } from "@/lib/rank";
import { SITE_URL } from "@/lib/config";
import { coinOf, getFeed, termCall } from "@/lib/pump";
import type { DuelPlayer, LiveDuelState, LiveFill } from "@/lib/types";
import { useApp } from "./AppProvider";
import Avatar from "./Avatar";
import CoinAvatar from "./term/CoinAvatar";
import Terminal, { type Bag, type DuelMark, type TermTrade } from "./term/Terminal";
import TopBar from "./TopBar";

const START = 10;

/** cash and bags of one player, rebuilt from their fills */
export function bookOf(fills: LiveFill[], slot: number) {
  const m = new Map<string, Bag>();
  let cash = START;
  for (const [s, , mint, sym, k, solAmt, tok] of fills) {
    if (s !== slot) continue;
    const b = m.get(mint) ?? { mint, sym: (sym || coinOf(mint).sym).replace(/^\$/, ""), uri: coinOf(mint).meta.uri, held: 0, cost: 0, got: 0, n: 0 };
    if (k === 1) {
      b.held += tok;
      b.cost += solAmt;
      cash -= solAmt;
    } else {
      b.held = Math.max(0, b.held - tok);
      b.got += solAmt;
      cash += solAmt;
    }
    b.n++;
    m.set(mint, b);
  }
  return { cash, bags: [...m.values()] };
}

export function equityOf(book: { cash: number; bags: Bag[] }, marks: Record<string, number | null>, fills: LiveFill[]) {
  let eq = book.cash;
  for (const b of book.bags) {
    if (b.held <= 0) continue;
    const c = coinOf(b.mint);
    const lastFill = [...fills].reverse().find((f) => f[2] === b.mint)?.[7] ?? 0;
    const px = c.vtok > 0 ? c.price() : marks[b.mint] ?? lastFill;
    eq += b.held * (px || 0);
  }
  return eq;
}

type Phase = "loading" | "queue" | "cancelled" | "vs" | "live" | "settling" | "final";

export default function LiveDuel({ id }: { id: string }) {
  const { session, refreshMe } = useApp();
  const [st, setSt] = useState<LiveDuelState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [local, setLocal] = useState<LiveFill[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [focus, setFocus] = useState<{ mint: string; at: number } | null>(null);
  const skew = useRef(0);

  const pull = useCallback(async () => {
    const t0 = Date.now();
    try {
      const d = await rpc<LiveDuelState>("yr_lduel", { p_duel: id, p_secret: session?.secret ?? null });
      skew.current = d.now - (t0 + Date.now()) / 2;
      setSt(d);
      setLocal((l) => l.filter((f) => !d.fills.some((x) => x[0] === f[0] && x[2] === f[2] && x[4] === f[4] && Math.abs(x[5] - f[5]) < 1e-6)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load the duel");
    }
  }, [id, session]);

  useEffect(() => {
    void pull();
  }, [pull]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const sNow = now + skew.current;
  const end = st?.start != null ? st.start + st.dur_ms : null;
  let phase: Phase = "loading";
  if (st) {
    if (st.status === "cancelled") phase = "cancelled";
    else if (st.status === "queue" || st.start == null) phase = "queue";
    else if (st.status === "done") phase = "final";
    else if (sNow < st.start) phase = "vs";
    else if (end != null && sNow < end) phase = "live";
    else phase = "settling";
  }

  useEffect(() => {
    if (!st) return;
    const ms = phase === "final" || phase === "cancelled" ? 8000 : phase === "live" ? 1200 : 900;
    const t = setInterval(pull, ms);
    return () => clearInterval(t);
  }, [st, phase, pull]);

  // the clock ran out: refresh the marks from the chain and settle
  useEffect(() => {
    if (phase !== "settling") return;
    let dead = false;
    const go = async () => {
      if (dead) return;
      await termCall({ action: "settle", duel: id }).catch(() => null);
      await pull();
    };
    const first = setTimeout(go, 1800);
    const t = setInterval(go, 3500);
    return () => {
      dead = true;
      clearTimeout(first);
      clearInterval(t);
    };
  }, [phase, id, pull]);

  const mySlot = st?.me ?? 1;
  const oppSlot = 3 - mySlot;
  const meP = st ? (mySlot === 1 ? st.p1 : st.p2) : null;
  const oppP = st ? (mySlot === 1 ? st.p2 : st.p1) : null;
  const ghostOpp = !!st?.ghost && oppSlot === 2;
  const fills = useMemo(() => [...(st?.fills ?? []), ...local], [st?.fills, local]);
  const mine = useMemo(() => bookOf(fills, mySlot), [fills, mySlot]);
  const theirs = useMemo(() => bookOf(fills, oppSlot), [fills, oppSlot]);
  const myEq = st ? (phase === "final" && st.eq[mySlot - 1] != null ? st.eq[mySlot - 1]! : equityOf(mine, st.marks, fills)) : START;
  const oppEq = st
    ? phase === "final" && st.eq[oppSlot - 1] != null
      ? st.eq[oppSlot - 1]!
      : ghostOpp
        ? st.g?.eq ?? START
        : equityOf(theirs, st.marks, fills)
    : START;
  const canTrade = !!session && st?.me != null && phase === "live";

  // keep the opponent's bags priced live too
  const oppKey = theirs.bags
    .filter((b) => b.held > 0)
    .map((b) => b.mint)
    .sort()
    .join(",");
  useEffect(() => {
    if (!oppKey) return;
    return getFeed().watch(oppKey.split(","));
  }, [oppKey]);

  const marks = useMemo<DuelMark[]>(
    () =>
      fills
        .filter((f) => f[0] === mySlot || (!ghostOpp && f[0] === oppSlot))
        .map((f) => ({ mint: f[2], t: f[1], k: (f[4] === 1 ? 1 : 2) as 1 | 2, who: (f[0] === mySlot ? "me" : "opp") as DuelMark["who"], sol: f[5], tok: f[6], px: f[7] })),
    [fills, mySlot, oppSlot, ghostOpp],
  );

  // opponent moves: a tick and a toast for each fresh one
  const seenOpp = useRef(new Set<string>());
  useEffect(() => {
    if (!st || !oppP || phase !== "live") return;
    const items: { key: string; k: number; sol: number; sym: string; fresh: boolean }[] = ghostOpp
      ? (st.g?.tr ?? []).map((t) => ({ key: `g${t[0]}:${t[1]}:${t[2]}`, k: t[1], sol: t[2], sym: st.p2?.sym ?? "", fresh: sNow - (st.start ?? 0) - t[0] < 6000 }))
      : st.fills.filter((f) => f[0] === oppSlot).map((f) => ({ key: `f${f[1]}:${f[2]}:${f[4]}`, k: f[4], sol: f[5], sym: f[3] ?? "", fresh: sNow - f[1] < 6000 }));
    for (const it of items) {
      if (seenOpp.current.has(it.key)) continue;
      seenOpp.current.add(it.key);
      if (!it.fresh) continue;
      sfx.tick();
      toast(`${oppP.name} ${it.k === 1 ? "bought" : "sold"} ${sol(it.sol, 2)} SOL${it.sym ? ` of $${it.sym}` : ""}`, it.k === 1 ? "up" : "down");
    }
  }, [st, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const finalSeen = useRef(false);
  useEffect(() => {
    if (phase !== "final" || finalSeen.current || !st) return;
    finalSeen.current = true;
    void refreshMe();
    if (st.me == null) return;
    if (st.winner === mySlot) {
      sfx.win();
      confetti();
      setTimeout(() => confetti(), 450);
      edgeGlow("up");
    } else if (st.winner === oppSlot) {
      sfx.lose();
      edgeGlow("down");
    }
  }, [phase, st, mySlot, oppSlot, refreshMe]);

  const onTrade = useCallback<TermTrade>(
    async (side, amount, coin, { slip }) => {
      if (!session) throw new Error("Create a profile first");
      const r = await termCall<{ sol: number; tok: number; px: number; at: number }>({
        action: "trade",
        secret: session.secret,
        duel: id,
        mint: coin.mint,
        sym: coin.sym,
        side,
        amount,
        expect: coin.price(),
        slip: slip / 100,
      });
      setLocal((l) => [...l, [mySlot, r.at, coin.mint, coin.sym, side === "buy" ? 1 : 2, r.sol, r.tok, r.px]]);
      void pull();
      return { sol: r.sol, tok: r.tok };
    },
    [session, id, mySlot, pull],
  );

  if (err) {
    return (
      <>
        <TopBar />
        <main className="center">
          <div>
            <p className="err">{err}</p>
            <Link href="/" className="btn btn-primary" style={{ marginTop: 14 }}>
              Back to the arena
            </Link>
          </div>
        </main>
      </>
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
  if (phase === "vs" && meP && oppP) return <VsLive left={meP} right={oppP} ghost={ghostOpp} ms={st.start! - sNow} />;

  const left = end != null ? end - sNow : 0;
  const myPnl = myEq - START;
  const oppPnl = oppEq - START;
  const hot = phase === "live" && left < 20_000;

  const hud = (
    <header className={`lhud ${hot ? "hot" : ""}`}>
      <HudSide p={meP} you={st.me != null} eq={myEq} pnl={myPnl} side="left" ghost={false} />
      <div className="lhud-mid">
        <span className="lbl">{phase === "live" ? "Live duel · 10 play SOL" : phase === "settling" ? "Time is up" : "Final"}</span>
        <div className={`lhud-clock mono ${hot ? "hot" : ""}`}>{phase === "live" ? clock(left) : phase === "settling" ? "0:00" : "FINAL"}</div>
        <span className="small dim">{phase === "settling" ? "Settling at the live price…" : "Biggest bag when the clock hits zero wins"}</span>
      </div>
      <HudSide p={oppP} you={false} eq={oppEq} pnl={oppPnl} side="right" ghost={ghostOpp} />
      <Tug a={myEq} b={oppEq} />
    </header>
  );

  const oppPanel = (
    <OppPanel
      st={st}
      p={oppP}
      ghost={ghostOpp}
      bags={theirs.bags}
      eq={oppEq}
      onPick={(mint) => setFocus({ mint, at: Date.now() })}
      sNow={sNow}
    />
  );

  return (
    <>
      <TopBar />
      {hot && <div className={`clock-vignette ${myEq >= oppEq ? "ahead" : "behind"}`} />}
      <main className="live-duel">
        <Terminal
          mode="paper"
          cash={mine.cash}
          bags={mine.bags}
          marks={marks}
          canTrade={canTrade}
          locked={st.me == null ? "Spectating" : phase === "settling" ? "Time is up" : null}
          onTrade={onTrade}
          hud={hud}
          aside={<div className="aside-opp">{oppPanel}</div>}
          oppPanel={oppPanel}
          focus={focus}
        />
      </main>
      {phase === "final" && <LiveFinal st={st} mySlot={mySlot} myEq={myEq} oppEq={oppEq} fills={fills} />}
    </>
  );
}

function HudSide({ p, you, eq, pnl, side, ghost }: { p: DuelPlayer | null; you: boolean; eq: number; pnl: number; side: "left" | "right"; ghost: boolean }) {
  const t = tier(p?.elo ?? 1000);
  return (
    <div className={`lhud-side ${side}`}>
      <Avatar look={p?.avatar} size={38} />
      <div className="lhud-who">
        <b>
          {p?.name ?? "…"}
          {you && <span className="chip chip-you">YOU</span>}
          {ghost && <span className="chip chip-ghost">GHOST</span>}
        </b>
        <span className="mono small" style={{ color: t.color }}>
          {t.name} · {p?.elo ?? "—"}
        </span>
      </div>
      <div className="lhud-eq">
        <b className={`mono t-${tone(pnl)}`}>{sol(eq, 2)}</b>
        <span className={`mono small t-${tone(pnl)}`}>{pct((pnl / START) * 100, 1)}</span>
      </div>
    </div>
  );
}

function Tug({ a, b }: { a: number; b: number }) {
  const pa = Math.max(0.0001, a);
  const pb = Math.max(0.0001, b);
  const share = Math.max(4, Math.min(96, (pa / (pa + pb)) * 100));
  const lead = a - b;
  return (
    <div className="tug lhud-tug" aria-label="Who is ahead">
      <div className="tug-a" style={{ width: `${share}%` }} />
      <div className="tug-b" style={{ width: `${100 - share}%` }} />
      <div className="tug-knot" style={{ left: `${share}%` }} />
      <span className={`tug-label mono ${lead >= 0 ? "t-up" : "t-down"}`}>
        {Math.abs(lead) < 0.005 ? "Even" : `${lead > 0 ? "You lead" : "Behind"} ${sol(Math.abs(lead), 2)} SOL`}
      </span>
    </div>
  );
}

function OppPanel({
  st,
  p,
  ghost,
  bags,
  eq,
  onPick,
  sNow,
}: {
  st: LiveDuelState;
  p: DuelPlayer | null;
  ghost: boolean;
  bags: Bag[];
  eq: number;
  onPick: (mint: string) => void;
  sNow: number;
}) {
  const g = st.g;
  const moves = ghost
    ? [...(g?.tr ?? [])].reverse().map((t) => ({ key: `${t[0]}${t[1]}${t[2]}`, k: t[1], sol: t[2], sym: st.p2?.sym ?? "?", at: (st.start ?? 0) + t[0], mint: null as string | null, mc: t[4] }))
    : st.fills
        .filter((f) => f[0] !== (st.me ?? 1))
        .reverse()
        .map((f) => ({ key: `${f[1]}${f[2]}${f[4]}`, k: f[4], sol: f[5], sym: f[3] ?? "?", at: f[1], mint: f[2], mc: f[7] * 1e9 }));
  return (
    <div className="opp-panel">
      <div className="panel-head">
        <span className="lbl">{ghost ? "Ghost's trades" : `${p?.name ?? "Opponent"}'s bags`}</span>
        <span className={`mono small t-${tone(eq - START)}`}>{sol(eq, 2)} SOL</span>
      </div>
      {ghost ? (
        <div className="ghost-coin">
          <span className="chip chip-ghost">REPLAY</span>
          <span className="small muted">
            Replays a real wallet&apos;s trades on <b>${st.p2?.sym ?? "?"}</b>, a real launch, scaled to a 10 SOL bag.
            {g?.px != null && g.sol_usd ? ` MC now ${usd(g.px * 1e9 * g.sol_usd)}.` : ""}
          </span>
        </div>
      ) : (
        <div className="opp-bags">
          {bags
            .filter((b) => b.held > 0)
            .map((b) => {
              const c = coinOf(b.mint);
              const value = b.held * c.price() * 0.99;
              const pnl = value + b.got - b.cost;
              return (
                <button key={b.mint} className="opp-bag" onClick={() => onPick(b.mint)} title="Open this coin">
                  <CoinAvatar mint={b.mint} uri={c.meta.uri} sym={b.sym} size={22} />
                  <b>{b.sym}</b>
                  <span className="mono small">{sol(value, 2)}</span>
                  <span className={`mono small ${pnl >= 0 ? "t-up" : "t-down"}`}>{signed(pnl, 2)}</span>
                </button>
              );
            })}
          {!bags.some((b) => b.held > 0) && <p className="small dim">No open bags. Watch the moves below.</p>}
        </div>
      )}
      <div className="moves">
        {moves.slice(0, 10).map((m) => (
          <div
            key={m.key}
            className={`move ${m.k === 1 ? "b" : "s"} ${m.mint ? "link" : ""}`}
            role={m.mint ? "button" : undefined}
            onClick={() => m.mint && onPick(m.mint)}
          >
            <span className="mono">{m.k === 1 ? "BUY" : "SELL"}</span>
            <b className="mono">{sol(m.sol, 2)}</b>
            <span className="mono dim">${m.sym.slice(0, 8)}</span>
            <span className="mono dim">{st.start ? clock(Math.max(0, m.at - st.start)) : ""}</span>
          </div>
        ))}
        {!moves.length && <p className="small dim">No moves yet{sNow < (st.start ?? 0) ? "" : ". Watch closely"}.</p>}
      </div>
    </div>
  );
}

function VsLive({ left, right, ghost, ms }: { left: DuelPlayer; right: DuelPlayer & { sym?: string }; ghost: boolean; ms: number }) {
  const sec = Math.ceil(ms / 1000);
  const last = useRef(-1);
  useEffect(() => {
    if (sec !== last.current && sec <= 3 && sec > 0) sfx.tick();
    last.current = sec;
  }, [sec]);
  const tl = tier(left.elo);
  const tr = tier(right.elo);
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
        <span className="small muted">3 minutes · any live pump.fun coin · 10 play SOL each</span>
      </div>
      <div className="vs-side r">
        <div className="vs-glow" />
        <Avatar look={right.avatar} size={150} />
        <b className="vs-name">
          {right.name}
          {ghost && <span className="chip chip-ghost">GHOST</span>}
        </b>
        <span className="mono" style={{ color: tr.color }}>
          {ghost ? `Replays a real wallet · ${right.elo}` : `${tr.name} · ${right.elo}`}
        </span>
        {!ghost && (
          <span className="mono small muted">
            {right.w ?? 0}W – {right.l ?? 0}L
          </span>
        )}
      </div>
    </main>
  );
}

function LiveFinal({ st, mySlot, myEq, oppEq, fills }: { st: LiveDuelState; mySlot: number; myEq: number; oppEq: number; fills: LiveFill[] }) {
  const router = useRouter();
  const { session, me } = useApp();
  const spectator = st.me == null;
  const won = st.winner === mySlot;
  const draw = st.winner === 0;
  const delta = st.elo[mySlot - 1];
  const opp = mySlot === 1 ? st.p2 : st.p1;
  const [shown, setShown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
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

  // the best closed or open bag of the duel
  const best = useMemo(() => {
    const b = bookOf(fills, mySlot).bags;
    let top: { sym: string; pnl: number } | null = null;
    for (const x of b) {
      const value = x.held * coinOf(x.mint).price() * 0.99;
      const pnl = value + x.got - x.cost;
      if (!top || pnl > top.pnl) top = { sym: x.sym, pnl };
    }
    return top;
  }, [fills, mySlot]);

  const again = async () => {
    if (!session) return router.push("/");
    setBusy(true);
    try {
      const r = await rpc<{ id: string; status: string }>("yr_lduel_find", { p_secret: session.secret });
      router.push(r.status === "live" ? `/live/${r.id}` : `/?live=${r.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not find a match", "down");
      setBusy(false);
    }
  };
  const myPct = ((myEq - START) / START) * 100;
  const oppPct = ((oppEq - START) / START) * 100;
  const share = `${won ? "Won" : draw ? "Drew" : "Lost"} a live 1v1 trading duel on yeppo: ${pct(myPct, 1)} vs ${pct(oppPct, 1)} in 3 minutes on real pump.fun coins. 1v1 me.`;
  const t = tier(me?.elo ?? 1000);
  if (!open) {
    return (
      <button className="final-reopen btn btn-primary" onClick={() => setOpen(true)}>
        Show result
      </button>
    );
  }
  return (
    <div className="final-back">
      <div className={`final ${won ? "win" : draw ? "draw" : "loss"}`}>
        <span className="lbl">{spectator ? "Duel over" : st.ghost ? "Live duel · vs ghost" : "Live duel · ranked"}</span>
        <h1 className="final-title">{spectator ? `${st.winner === 1 ? st.p1.name : st.winner === 2 ? st.p2?.name : "Nobody"} wins` : won ? "Victory" : draw ? "Draw" : "Defeat"}</h1>
        <div className="final-score mono">
          <span className={myPct >= 0 ? "t-up" : "t-down"}>{pct(myPct, 1)}</span>
          <i>vs</i>
          <span className={oppPct >= 0 ? "t-up" : "t-down"}>{pct(oppPct, 1)}</span>
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
              <span className="lbl">Final bag</span>
              <b className="mono">{sol(myEq, 2)} SOL</b>
              <span className="small muted">{best ? `best: $${best.sym} ${signed(best.pnl, 2)}` : "no trades"}</span>
            </div>
            <div>
              <span className="lbl">Opponent</span>
              <b className="opp-name">
                <Avatar look={opp?.avatar} size={20} /> {opp?.name}
              </b>
              <span className="small muted mono">{st.ghost ? "ghost of a real wallet" : `${opp?.elo ?? ""} rating`}</span>
            </div>
          </div>
        )}
        {st.g?.reveal && (
          <p className="small muted">
            The ghost replayed a real trader on{" "}
            <a href={`https://pump.fun/coin/${st.g.reveal.mint}`} target="_blank" rel="noreferrer">
              {st.g.reveal.name} (${st.g.reveal.symbol}) ↗
            </a>
          </p>
        )}
        <div className="final-actions">
          <button className="btn btn-primary big" onClick={again} disabled={busy}>
            {busy ? "Finding…" : "Play again"}
          </button>
          <a
            className="btn big"
            href={`https://x.com/intent/post?text=${encodeURIComponent(share)}&url=${encodeURIComponent(`${SITE_URL}/live/${st.id}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            Share on 𝕏
          </a>
          <button className="btn btn-ghost big" onClick={() => setOpen(false)}>
            See the board
          </button>
        </div>
      </div>
    </div>
  );
}
