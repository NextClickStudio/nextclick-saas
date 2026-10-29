"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { rpc } from "@/lib/supabase";
import { age, clock, pct } from "@/lib/format";
import { sfx, toast } from "@/lib/fx";
import { tier } from "@/lib/rank";
import type { RealBoard } from "@/lib/types";
import { useApp } from "./AppProvider";
import Avatar from "./Avatar";
import TopBar from "./TopBar";
import WalletConnect from "./WalletConnect";

const DURS = [5, 15, 30, 60];

export default function RealHub() {
  const router = useRouter();
  const { me, session } = useApp();
  const [board, setBoard] = useState<RealBoard | null>(null);
  const [dur, setDur] = useState(15);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [offline, setOffline] = useState(false);

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
              Challenge a trader for 5 to 60 minutes. You both trade memecoins with your own wallets, on pump.fun or any app built on it. yeppo reads every
              trade from the Solana chain. The higher ROI wins and the win is stamped on your profile.
            </p>
            <ol className="steps steps-row">
              <li>
                <b>Verify</b> your wallet with a free signature
              </li>
              <li>
                <b>Challenge</b> anyone, or accept an open duel
              </li>
              <li>
                <b>Trade</b> on pump.fun, Axiom, GMGN, Photon…
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
                ) : (
                  <div className="create">
                    <span className="lbl">Duel length</span>
                    <div className="seg">
                      {DURS.map((d) => (
                        <button key={d} className={dur === d ? "on" : ""} onClick={() => setDur(d)}>
                          {d} min
                        </button>
                      ))}
                    </div>
                    <button className="btn btn-primary big" onClick={create} disabled={busy}>
                      {busy ? "Creating…" : "Create challenge"}
                    </button>
                  </div>
                )}
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
                <Avatar look={l.a2} size={24} />
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
