"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rpc } from "@/lib/supabase";
import { age, compact, pct, usd } from "@/lib/format";
import { sfx, toast } from "@/lib/fx";
import { tier } from "@/lib/rank";
import type { Arena as ArenaT, DuelPlayer } from "@/lib/types";
import { useApp } from "./AppProvider";
import Avatar from "./Avatar";
import Radar, { type Blip } from "./Radar";
import TopBar from "./TopBar";

type Mode = "live" | "real" | "replay";
type Found = { id: string; status: string; me: 1 | 2 | null; ghost: boolean; p1: DuelPlayer; p2: DuelPlayer | null };
const missing = (e: unknown) => e instanceof Error && /function|schema cache|does not exist/i.test(e.message);

export default function Arena() {
  const router = useRouter();
  const { me, session, openCreator, ready } = useApp();
  const [arena, setArena] = useState<ArenaT | null>(null);
  const [mode, setMode] = useState<Mode>("live");
  const [search, setSearch] = useState<{ id: string; t0: number; kind: "live" | "replay" } | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [wide, setWide] = useState(true);
  const wantFind = useRef(false);

  const load = useCallback(async () => {
    try {
      setArena(await rpc<ArenaT>("yr_arena", { p_secret: session?.secret ?? null }));
    } catch {
      /* keep the last snapshot */
    }
  }, [session]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 120);
    const onResize = () => setWide(window.innerWidth > 980);
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      clearInterval(t);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const find = useCallback(async () => {
    if (mode === "real") {
      router.push("/real");
      return;
    }
    if (!session) {
      wantFind.current = true;
      openCreator(true);
      return;
    }
    if (busy || search) return;
    setBusy(true);
    try {
      let kind: "live" | "replay" = mode === "live" ? "live" : "replay";
      let r: { id: string; status: string };
      try {
        r = await rpc<{ id: string; status: string }>(kind === "live" ? "yr_lduel_find" : "yr_duel_find", { p_secret: session.secret });
      } catch (e) {
        if (kind !== "live" || !missing(e)) throw e;
        // live duels are not switched on yet: fall back to a replay duel
        toast("Live duels are switching on. Starting a replay duel.", "info");
        kind = "replay";
        r = await rpc<{ id: string; status: string }>("yr_duel_find", { p_secret: session.secret });
      }
      if (r.status === "live") {
        sfx.go();
        router.push(kind === "live" ? `/live/${r.id}` : `/duel/${r.id}`);
        return;
      }
      sfx.tick();
      setSearch({ id: r.id, t0: Date.now(), kind });
    } catch (e) {
      sfx.error();
      toast(e instanceof Error ? e.message : "Could not find a match", "down");
    } finally {
      setBusy(false);
    }
  }, [mode, session, busy, search, openCreator, router]);

  const cancel = useCallback(async () => {
    if (!search || !session) return;
    const id = search.id;
    setSearch(null);
    try {
      await rpc(search.kind === "live" ? "yr_lduel_cancel" : "yr_duel_cancel", { p_secret: session.secret, p_duel: id });
    } catch {
      /* the sweeper drops stale queue entries anyway */
    }
  }, [search, session]);

  // "Play again" from a finished duel lands here already queued
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const live = qs.get("live");
    const replay = qs.get("find");
    const id = live ?? replay;
    if (id && /^[0-9a-f-]{36}$/.test(id)) {
      setMode(live ? "live" : "replay");
      setSearch({ id, t0: Date.now(), kind: live ? "live" : "replay" });
      window.history.replaceState(null, "", "/");
    }
  }, []);

  // created a profile from the button: go straight to matchmaking
  useEffect(() => {
    if (session && wantFind.current) {
      wantFind.current = false;
      void find();
    }
  }, [session, find]);

  // waiting room: the server pairs us with a player, or a ghost after a few seconds
  useEffect(() => {
    if (!search || !session) return;
    let dead = false;
    const t = setInterval(async () => {
      try {
        const d = await rpc<Found>(search.kind === "live" ? "yr_lduel" : "yr_duel", { p_duel: search.id, p_secret: session.secret });
        if (dead) return;
        if (d.status === "live" || d.status === "done") {
          clearInterval(t);
          setFound(d);
          sfx.go();
          setTimeout(() => router.push(search.kind === "live" ? `/live/${d.id}` : `/duel/${d.id}`), 1300);
        } else if (d.status === "cancelled") {
          clearInterval(t);
          setSearch(null);
        }
      } catch {
        /* retry */
      }
    }, 900);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, [search, session, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [contenteditable], .modal")) return;
      if (e.code === "Escape" && search) {
        void cancel();
      } else if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (search) void cancel();
        else void find();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [find, cancel, search]);

  const blips = useMemo<Blip[]>(
    () => (arena?.pulse.coins ?? []).map(([name, sym, ageMs, mc, n]) => ({ id: `${name}:${sym}`, label: `$${(sym || name).slice(0, 8).toUpperCase()}`, up: mc >= 4000 || n > 60, age: ageMs })),
    [arena],
  );

  const names = useMemo(() => {
    const pool = [...(arena?.top ?? []).map((x) => x.name), ...(arena?.recent ?? []).flatMap((x) => [x.n1, x.n2])];
    return pool.length ? pool : ["degen_frog", "0xshark", "sol_sniper", "rugwatch", "moonboi", "trenchlord"];
  }, [arena]);

  const searching = !!search && !found;
  const waited = search ? Math.floor((Date.now() - search.t0) / 1000) : 0;
  const t = tier(me?.elo ?? 1000);
  const opp = found ? (found.me === 2 ? found.p1 : found.p2) : null;

  return (
    <>
      <div className="world" />
      <TopBar online={arena?.online} />
      <Ticker coins={arena?.pulse.coins ?? []} />
      <main className="arena">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <i className="live-dot" /> Live on real pump.fun data
            </span>
            <h1 className="hero-title">
              1v1 me<span>.</span>
            </h1>
            <p className="hero-sub">
              {mode === "replay"
                ? "Best of 3 on replayed pump.fun launches. Same coin, same bag, one winner. Read the chart, dodge the rug, out-trade the trader in front of you."
                : "3 minutes. Every live pump.fun coin. A full trading terminal and a real trader in front of you. Biggest bag when the clock hits zero wins."}
            </p>

            <div className="mode-switch three" role="tablist">
              <button role="tab" aria-selected={mode === "live"} className={mode === "live" ? "on" : ""} onClick={() => setMode("live")}>
                <span className="mode-ico">⚡</span>
                <span>
                  <b>Live duel</b>
                  <small>3 min · any live coin · play SOL</small>
                </span>
              </button>
              <button role="tab" aria-selected={mode === "real"} className={mode === "real" ? "on" : ""} onClick={() => setMode("real")}>
                <span className="mode-ico">⛓</span>
                <span>
                  <b>Real duel</b>
                  <small>Your wallet · verified on-chain</small>
                </span>
              </button>
              <button role="tab" aria-selected={mode === "replay"} className={mode === "replay" ? "on" : ""} onClick={() => setMode("replay")}>
                <span className="mode-ico">↺</span>
                <span>
                  <b>Replay blitz</b>
                  <small>Best of 3 · replayed launches</small>
                </span>
              </button>
            </div>

            <div className="cta-row">
              {searching ? (
                <button className="find-btn searching" onClick={cancel}>
                  <span className="spin-ring" />
                  Searching… {waited}s<kbd>Esc</kbd>
                </button>
              ) : (
                <button className="find-btn" onClick={find} disabled={busy || !!found || (mode !== "real" && arena != null && arena.pool < 6)}>
                  {found ? "Opponent found" : mode === "real" ? "Open real duels" : arena && arena.pool < 6 ? "Warming up" : "Find match"}
                  <kbd>Space</kbd>
                </button>
              )}
              <div className="cta-meta">
                {mode === "live" ? (
                  <>
                    <b>Ranked</b> · pick any coin, presets, slippage, hotkeys
                    <br />
                    Fills on the real bonding curve. No one online? A <b>ghost</b> of a real wallet.
                  </>
                ) : mode === "replay" ? (
                  <>
                    <b>Ranked</b> · 3 rounds of 75 s on real launches
                    <br />
                    No one online? You duel the <b>ghost</b> of a real wallet.
                  </>
                ) : (
                  <>
                    <b>Real money, your wallet</b> · trade on any pump.fun app
                    <br />
                    Highest ROI wins. Nothing moves through yeppo.
                  </>
                )}
              </div>
            </div>

            {arena?.active && !search && (
              <div className="active-banner">
                <span>
                  <b>You are in a live duel.</b> <span className="muted">Your opponent is waiting.</span>
                </span>
                <button className="btn btn-primary btn-sm" onClick={() => router.push(arena.active!.kind === "live" ? `/live/${arena.active!.id}` : `/duel/${arena.active!.id}`)}>
                  Rejoin
                </button>
              </div>
            )}

            <div className="hero-stats">
              <Stat label="Online" value={arena ? String(arena.online) : "—"} live />
              <Stat label="Live duels" value={arena ? String(arena.live) : "—"} />
              <Stat label="Duels today" value={arena ? compact(arena.today) : "—"} />
              <Stat label="pump.fun trades / min" value={arena ? compact(arena.pulse.trades) : "—"} />
              <Stat label="Launches / 10 min" value={arena ? String(arena.pulse.launches) : "—"} />
            </div>
          </div>

          <div className="hero-scope">
            <div className={`scope ${searching ? "is-searching" : ""} ${found ? "is-found" : ""}`}>
              <Radar blips={blips} searching={searching} size={wide ? 400 : 300} />
              <div className="scope-center">
                {found && opp ? (
                  <div className="found">
                    <span className="lbl">Opponent found</span>
                    <Avatar look={opp.avatar} size={64} />
                    <b>{opp.name}</b>
                    <span className="mono small muted">
                      {found.ghost ? "Ghost · replays a real wallet" : `${opp.elo} rating`}
                    </span>
                  </div>
                ) : searching ? (
                  <div className="seeking">
                    <span className="lbl">Scanning</span>
                    <b className="mono roulette">{names[tick % names.length]}</b>
                    <span className="small muted">{waited < 6 ? "Looking for a player near your rating" : "Calling in a ghost…"}</span>
                  </div>
                ) : (
                  <div className="idle">
                    {me ? <Avatar look={me.avatar} size={56} /> : <span className="idle-dot" />}
                    <span className="lbl">{me ? `${t.name} · ${me.elo}` : "Ready when you are"}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="scope-legend">
              <span>
                <i className="dot up" /> live launches
              </span>
              <span>
                <i className="dot down" /> cooling off
              </span>
              <span className="mono">{arena ? `${arena.pool} coins in the duel pool` : ""}</span>
            </div>
          </div>
        </section>

        <section className="arena-grid">
          <div className="panel card-me">
            <div className="panel-head">
              <span className="lbl">Your card</span>
              {me && (
                <Link href="/career" className="small muted">
                  Profile →
                </Link>
              )}
            </div>
            {me ? (
              <>
                <div className="me-top">
                  <Avatar look={me.avatar} size={52} />
                  <div style={{ minWidth: 0 }}>
                    <b className="me-name">{me.handle}</b>
                    <div className="me-tags">
                      <span className="chip" style={{ color: t.color }}>
                        {t.name}
                      </span>
                      {me.wallet && <span className="chip chip-up">✓ Verified</span>}
                      {me.streak >= 2 && <span className="chip chip-gold">🔥 {me.streak} streak</span>}
                    </div>
                  </div>
                  <div className="me-elo">
                    <span className="lbl">Rating</span>
                    <b className="mono">{me.elo}</b>
                  </div>
                </div>
                <div className="bar" style={{ marginTop: 12 }}>
                  <i style={{ width: `${t.pct}%`, background: t.color }} />
                </div>
                <div className="small muted" style={{ marginTop: 5 }}>
                  {t.next ? `${t.next.min - me.elo} to ${t.next.name}` : "Top tier"}
                </div>
                <div className="kv-grid" style={{ marginTop: 12 }}>
                  <div>
                    <span className="lbl">Won</span>
                    <b className="mono t-up">{me.d_won}</b>
                  </div>
                  <div>
                    <span className="lbl">Lost</span>
                    <b className="mono t-down">{me.d_lost}</b>
                  </div>
                  <div>
                    <span className="lbl">Best streak</span>
                    <b className="mono">{me.best_streak}</b>
                  </div>
                </div>
              </>
            ) : (
              ready && (
                <div className="empty-me">
                  <p className="muted">No email, no wallet needed. Pick a name and a face and you are in the queue in 10 seconds.</p>
                  <button className="btn btn-primary" onClick={() => openCreator(true)}>
                    Create profile
                  </button>
                </div>
              )
            )}
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="lbl">
                <i className="live-dot" style={{ marginRight: 6 }} />
                Latest duels
              </span>
              <span className="small dim">{arena ? `${arena.today} today` : ""}</span>
            </div>
            <div className="recent">
              {(arena?.recent ?? []).slice(0, 7).map((d) => (
                <Link key={d.id} href={d.kind === "live" ? `/live/${d.id}` : `/duel/${d.id}`} className="recent-row">
                  <span className={`who ${d.winner === 1 ? "won" : ""}`}>
                    <Avatar look={d.a1} size={20} />
                    <span className="nm">{d.n1}</span>
                  </span>
                  {d.kind === "live" ? (
                    <span className="score mono pctscore">
                      <b className={d.winner === 1 ? "t-up" : ""}>{pct(d.s1 ?? 0, 0)}</b>
                      <i>⚡</i>
                      <b className={d.winner === 2 ? "t-up" : ""}>{pct(d.s2 ?? 0, 0)}</b>
                    </span>
                  ) : (
                    <span className="score mono">
                      <b className={d.winner === 1 ? "t-up" : ""}>{d.s1 ?? 0}</b>
                      <i>–</i>
                      <b className={d.winner === 2 ? "t-up" : ""}>{d.s2 ?? 0}</b>
                    </span>
                  )}
                  <span className={`who right ${d.winner === 2 ? "won" : ""}`}>
                    <span className={`nm ${d.ghost ? "ghost-name" : ""}`} title={d.ghost ? "Ghost: replays a real wallet" : undefined}>
                      {d.n2}
                    </span>
                    <Avatar look={d.a2} size={20} />
                  </span>
                  <span className="small dim ago">{age(Date.now() - d.ended)}</span>
                </Link>
              ))}
              {arena && !arena.recent.length && <p className="muted small">No duels yet today. Be the first on the board.</p>}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="lbl">Top duelists</span>
              <Link href="/leaderboard" className="small muted">
                Leaderboard →
              </Link>
            </div>
            <div className="mini-lb">
              {(arena?.top ?? []).map((u, i) => (
                <div key={u.name} className="row">
                  <span className={`mono rank r${i + 1}`}>{i + 1}</span>
                  <Avatar look={u.avatar} size={22} />
                  <span className="nm">{u.name}</span>
                  <span className="mono small dim">
                    {u.w}–{u.l}
                  </span>
                  <span className="mono" style={{ color: tier(u.elo).color }}>
                    {u.elo}
                  </span>
                </div>
              ))}
              {arena && !arena.top.length && <p className="muted small">The board is empty. Win one duel and you are on it.</p>}
            </div>
          </div>

          <div className="panel how">
            <div className="panel-head">
              <span className="lbl">How a duel works</span>
            </div>
            <ol className="steps">
              <li>
                <b>A full terminal.</b> Live pump.fun launches, real-time charts, presets, slippage and hotkeys, like the apps you already use.
              </li>
              <li>
                <b>Real prices, play money.</b> You both get 10 SOL. Every fill is priced on the coin&apos;s bonding curve, read from the chain at that moment.
              </li>
              <li>
                <b>See your opponent.</b> Their bags and every trade show up live. Copy them or fade them.
              </li>
              <li>
                <b>3 minutes, one winner.</b> The biggest bag at zero takes the duel and the rating. Sitting out loses.
              </li>
            </ol>
          </div>
        </section>

        <section className="real-strip">
          <div>
            <span className="eyebrow">
              <span className="chain-dot" /> Real duels · verified on-chain
            </span>
            <h2>Put your real wallet on the line.</h2>
            <p className="muted">
              Challenge any trader for 5 to 60 minutes. Both of you trade with your own wallets on pump.fun, Axiom, GMGN or any app. yeppo reads the
              trades from the chain, and the higher ROI takes the win. No deposits, no fees, nothing moves through us.
            </p>
          </div>
          <div className="real-cta">
            <Link href="/real" className="btn btn-primary">
              Open real duels
            </Link>
            <span className="small muted">Free signature to verify your wallet. It cannot move funds.</span>
          </div>
        </section>
      </main>
    </>
  );
}

function Stat({ label, value, live }: { label: string; value: string; live?: boolean }) {
  return (
    <div className="hstat">
      <span className="lbl">
        {live && <i className="dot up" />}
        {label}
      </span>
      <b className="mono">{value}</b>
    </div>
  );
}

function Ticker({ coins }: { coins: [string, string, number, number, number][] }) {
  if (!coins.length) return <div className="ticker" />;
  const items = [...coins, ...coins];
  return (
    <div className="ticker" aria-label="Live pump.fun launches">
      <span className="ticker-tag">
        <i className="live-dot" /> PUMP.FUN LIVE
      </span>
      <div className="ticker-track">
        <div className="ticker-run">
          {items.map(([name, sym, ageMs, mc, n], i) => (
            <span key={i} className="tk">
              {ageMs < 90_000 && <em>NEW</em>}
              <b>${(sym || name).slice(0, 10).toUpperCase()}</b>
              <span className="dim">{name.slice(0, 18)}</span>
              <span className={mc >= 5000 ? "t-up" : ""}>{mc > 0 ? usd(mc) : "—"}</span>
              <span className="dim">{age(ageMs)}</span>
              <span className="dim">{n} tx</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
