"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { rpc } from "@/lib/supabase";
import { age, clock, pct } from "@/lib/format";
import { sfx, toast } from "@/lib/fx";
import { tier } from "@/lib/rank";
import type { RealBoard } from "@/lib/types";
import { useApp } from "./AppProvider";
import Avatar from "./Avatar";
import TopBar from "./TopBar";
import TradingWallets from "./TradingWallets";
import WalletConnect from "./WalletConnect";

const DURS = [5, 15, 30, 60];
const QUICK = [5, 10, 15];
type Found = { status: "queue" | "live"; code?: string; ghost?: boolean; waited?: number; waiting?: number };

export default function RealHub() {
  const router = useRouter();
  const { me, session } = useApp();
  const [board, setBoard] = useState<RealBoard | null>(null);
  const [dur, setDur] = useState(15);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [offline, setOffline] = useState(false);
  const [qdur, setQdur] = useState(5);
  const [search, setSearch] = useState<{ since: number; waiting: number } | null>(null);
  const [friend, setFriend] = useState(false);
  const finding = useRef(false);

  const load = useCallback(async () => {
    try {
      setBoard(await rpc<RealBoard>("yr_rduel_board", { p_secret: session?.secret ?? null }));
      setOffline(false);
    } catch (e) {
      // the on-chain side is not switched on yet
      if (e instanceof Error && /function|schema cache|does not exist/i.test(e.message)) setOffline(true);
    }
  }, [session]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 5000);
    const c = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(t);
      clearInterval(c);
    };
  }, [load]);

  // matchmaking: ask every 2 seconds; the server pairs you, or hands you a live trader after 25 seconds
  const find = useCallback(
    async (ghost: boolean) => {
      if (!session || finding.current) return;
      finding.current = true;
      try {
        const r = await rpc<Found>("yr_rduel_find", { p_secret: session.secret, p_minutes: qdur, p_ghost: ghost });
        if (r.status === "live" && r.code) {
          sfx.go();
          toast(r.ghost ? "Matched with a live pump.fun trader" : "Opponent found", "up");
          setSearch(null);
          router.push(`/real/${r.code}`);
          return;
        }
        setSearch((s) => ({ since: s?.since ?? Date.now() - (r.waited ?? 0), waiting: r.waiting ?? 0 }));
        if (ghost) toast("No live trader to pair right now. Still searching…", "info");
      } catch (e) {
        sfx.error();
        setSearch(null);
        toast(e instanceof Error ? e.message : "Could not search", "down");
      } finally {
        finding.current = false;
      }
    },
    [session, qdur, router],
  );

  const searchingNow = !!search;
  useEffect(() => {
    if (!searchingNow) return;
    const t = setInterval(() => void find(false), 2000);
    return () => clearInterval(t);
  }, [searchingNow, find]);

  const start = () => {
    sfx.go();
    setSearch({ since: Date.now(), waiting: 0 });
    void find(false);
  };
  const stop = async () => {
    setSearch(null);
    if (session) await rpc("yr_rduel_leave", { p_secret: session.secret }).catch(() => null);
  };

  const create = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const r = await rpc<{ code: string }>("yr_rduel_create", { p_secret: session.secret, p_minutes: dur });
      sfx.go();
      router.push(`/real/${r.code}`);
    } catch (e) {
      sfx.error();
      toast(e instanceof Error ? e.message : "Could not create the challenge", "down");
      setBusy(false);
    }
  };

  const accept = async (code: string) => {
    if (!session || !me?.wallet) {
      router.push(`/real/${code}`);
      return;
    }
    try {
      await rpc("yr_rduel_accept", { p_secret: session.secret, p_code: code });
      sfx.go();
      router.push(`/real/${code}`);
    } catch (e) {
      sfx.error();
      toast(e instanceof Error ? e.message : "Could not accept", "down");
    }
  };

  return (
    <>
      <div className="world" />
      <TopBar />
      <main className="page real">
        <section className="real-hero">
          <div>
            <span className="eyebrow">
              <span className="chain-dot" /> Real duels · verified on-chain
            </span>
            <h1 className="hero-title sm">
              Your wallet. Your trades.
              <br />
              One winner<span>.</span>
            </h1>
            <p className="hero-sub">
              Press Find and yeppo puts a trader in front of you: another player, or a real pump.fun wallet that is trading right now. You both trade with your
              own wallets, on the yeppo terminal, pump.fun, Axiom, GMGN or any app. Every trade is read from the chain. Highest ROI wins.
            </p>
            <ol className="steps steps-row">
              <li>
                <b>Verify</b> your wallet with a free signature
              </li>
              <li>
                <b>Link</b> your Axiom, GMGN or Photon wallet
              </li>
              <li>
                <b>Find</b> a duel: a player or a live trader
              </li>
              <li>
                <b>Highest ROI</b> takes the win and the rating
              </li>
            </ol>
          </div>
          <div className="panel real-card">
            <div className="panel-head">
              <span className="lbl">Your real duel</span>
            </div>
            {offline ? (
              <div className="note">
                <b>Real duels are switching on.</b> Wallet checks and challenges open in a few minutes. Practice duels are live now.
              </div>
            ) : (
              <WalletConnect />
            )}
            {me?.wallet && !offline && (
              <>
                {board?.mine ? (
                  <div className="mine-duel">
                    <p className="small muted">
                      {board.mine.status === "open" ? "Your challenge is open. Share the link and wait for a taker." : "Your duel is live."}
                    </p>
                    <Link href={`/real/${board.mine.code}`} className="btn btn-primary">
                      {board.mine.status === "open" ? "Open my challenge" : "Go to my duel"}
                    </Link>
                  </div>
                ) : search ? (
                  <div className="mm">
                    <div className="mm-radar" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </div>
                    <b className="display">Finding a {qdur} min duel</b>
                    <span className="mono mm-clock">{clock(Math.max(0, now - search.since))}</span>
                    <p className="small muted">
                      {search.waiting > 0 ? `${search.waiting} other player${search.waiting > 1 ? "s" : ""} searching` : "Looking for players"} ·{" "}
                      {board?.traders ?? 0} live traders ready. Nobody in 25 seconds? A live pump.fun trader takes the other side.
                    </p>
                    <div className="row-btns">
                      <button className="btn btn-primary" onClick={() => void find(true)}>
                        Duel a live trader now
                      </button>
                      <button className="btn btn-ghost" onClick={stop}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="create">
                    <span className="lbl">Duel length</span>
                    <div className="seg">
                      {QUICK.map((d) => (
                        <button key={d} className={qdur === d ? "on" : ""} onClick={() => setQdur(d)}>
                          {d} min
                          {(board?.searching?.[String(d)] ?? 0) > 0 && <span className="seg-dot" />}
                        </button>
                      ))}
                    </div>
                    <button className="btn btn-primary big find-real" onClick={start}>
                      Find real duel
                    </button>
                    <span className="small dim">
                      {Object.values(board?.searching ?? {}).reduce((a, b) => a + b, 0)} searching · {board?.traders ?? 0} live traders on pump.fun
                    </span>
                    {friend ? (
                      <div className="friend">
                        <span className="lbl">Challenge a friend with a link</span>
                        <div className="seg sm">
                          {DURS.map((d) => (
                            <button key={d} className={dur === d ? "on" : ""} onClick={() => setDur(d)}>
                              {d} min
                            </button>
                          ))}
                        </div>
                        <button className="btn" onClick={create} disabled={busy}>
                          {busy ? "Creating…" : "Create challenge link"}
                        </button>
                      </div>
                    ) : (
                      <button className="link-btn small" onClick={() => setFriend(true)}>
                        Or challenge a friend with a link
                      </button>
                    )}
                  </div>
                )}
                <TradingWallets />
              </>
            )}
            <ul className="rules small muted">
              <li>Only trades inside the duel window count.</li>
              <li>Selling a bag bought before the start earns nothing.</li>
              <li>Buy at least 0.1 SOL to qualify. Open positions are marked at the live price.</li>
              <li>Counts pump.fun bonding-curve trades, whichever app sends them.</li>
              <li>No deposits, no fees, no prizes in money. You only ever sign a message.</li>
            </ul>
          </div>
        </section>

        <section className="real-grid">
          <div className="panel">
            <div className="panel-head">
              <span className="lbl">Open challenges</span>
              <span className="small dim">{board?.open.length ?? 0}</span>
            </div>
            {(board?.open ?? []).map((o) => (
              <div key={o.code} className="ch-row">
                <Avatar look={o.avatar} size={30} />
                <div className="ch-meta">
                  <b>{o.name}</b>
                  <span className="small mono" style={{ color: tier(o.elo).color }}>
                    {o.elo} · {o.rw}/{o.rp} real wins
                  </span>
                </div>
                <span className="chip mono">{o.dur_ms / 60000} min</span>
                <span className="small dim">{age(now - o.created)}</span>
                {me && board?.mine?.code === o.code ? (
                  <Link href={`/real/${o.code}`} className="btn btn-sm">
                    Yours
                  </Link>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={() => accept(o.code)}>
                    Accept
                  </button>
                )}
              </div>
            ))}
            {board && !board.open.length && <p className="small muted">No open challenges. Create one and post the link on 𝕏.</p>}
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="lbl">
                <i className="live-dot" style={{ marginRight: 6 }} />
                Live now
              </span>
            </div>
            {(board?.live ?? []).map((l) => (
              <Link key={l.code} href={`/real/${l.code}`} className="ch-row live">
                <Avatar look={l.a1} size={24} />
                <b>{l.n1}</b>
                <span className="dim small">vs</span>
                <b>{l.n2}</b>
                {l.ghost ? <span className="chip chip-ghost">LIVE TRADER</span> : <Avatar look={l.a2} size={24} />}
                <span className="mono small" style={{ marginLeft: "auto" }}>
                  {now < l.start ? `starts ${clock(l.start - now)}` : `${clock(l.end - now)} left`}
                </span>
              </Link>
            ))}
            {board && !board.live.length && <p className="small muted">No real duels running right now.</p>}
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="lbl">Latest results</span>
            </div>
            {(board?.recent ?? []).map((r) => (
              <Link key={r.code} href={`/real/${r.code}`} className="ch-row">
                <span className={r.winner === 1 ? "won" : ""}>
                  <b>{r.n1}</b> <span className="mono small">{r.r1 != null ? pct(r.r1 * 100, 1) : "—"}</span>
                </span>
                <span className="dim small">vs</span>
                <span className={r.winner === 2 ? "won" : ""}>
                  <b>{r.n2}</b> <span className="mono small">{r.r2 != null ? pct(r.r2 * 100, 1) : "—"}</span>
                </span>
                <span className="small dim" style={{ marginLeft: "auto" }}>
                  {age(now - r.end_ms)}
                </span>
              </Link>
            ))}
            {board && !board.recent.length && <p className="small muted">The first verified result shows up here.</p>}
          </div>
        </section>
      </main>
    </>
  );
}
