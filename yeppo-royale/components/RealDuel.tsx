"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { rpc } from "@/lib/supabase";
import { age, clock, pct, signed, sol } from "@/lib/format";
import { confetti, sfx, toast } from "@/lib/fx";
import { tier } from "@/lib/rank";
import { SITE_URL } from "@/lib/config";
import { short, solscanAccount, solscanTx } from "@/lib/wallet";
import type { RealDuel as RealDuelT, RealPlayer, RealScore } from "@/lib/types";
import { useApp } from "./AppProvider";
import Avatar from "./Avatar";
import TopBar from "./TopBar";
import WalletConnect from "./WalletConnect";

export default function RealDuel({ code }: { code: string }) {
  const { me, session, refreshMe } = useApp();
  const [d, setD] = useState<RealDuelT | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const skew = useRef(0);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const t0 = Date.now();
    try {
      const x = await rpc<RealDuelT>("yr_rduel_get", { p_code: code, p_secret: session?.secret ?? null });
      skew.current = x.now - (t0 + Date.now()) / 2;
      setD(x);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load the duel");
    }
  }, [code, session]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const ms = d?.status === "live" ? 3000 : d?.status === "open" ? 4000 : 15000;
    const t = setInterval(load, ms);
    const c = setInterval(() => setNow(Date.now()), 500);
    return () => {
      clearInterval(t);
      clearInterval(c);
    };
  }, [load, d?.status]);

  const doneSeen = useRef(false);
  useEffect(() => {
    if (d?.status !== "done" || doneSeen.current) return;
    doneSeen.current = true;
    void refreshMe();
    if (d.me != null && d.winner === d.me) {
      sfx.win();
      confetti();
    }
  }, [d, refreshMe]);

  if (err) {
    return (
      <>
        <TopBar />
        <main className="center">
          <div>
            <p className="err">{err}</p>
            <Link href="/real" className="btn btn-primary" style={{ marginTop: 14 }}>
              Real duels
            </Link>
          </div>
        </main>
      </>
    );
  }
  if (!d) {
    return (
      <>
        <TopBar />
        <main className="center">
          <i className="spinner" />
        </main>
      </>
    );
  }

  const sNow = now + skew.current;
  const link = `${SITE_URL}/real/${d.code}`;
  const accept = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await rpc("yr_rduel_accept", { p_secret: session.secret, p_code: d.code });
      sfx.go();
      await load();
    } catch (e) {
      sfx.error();
      toast(e instanceof Error ? e.message : "Could not accept", "down");
    } finally {
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (!session) return;
    await rpc("yr_rduel_cancel", { p_secret: session.secret, p_code: d.code }).catch(() => null);
    await load();
  };

  if (d.status === "open" || d.status === "cancelled" || d.status === "expired") {
    const mine = d.me === 1;
    const t = tier(d.p1.elo);
    return (
      <>
        <div className="world" />
        <TopBar />
        <main className="page">
          <div className="challenge">
            <span className="eyebrow">
              <span className="chain-dot" /> Real duel challenge
            </span>
            <div className="challenge-card panel">
              <Avatar look={d.p1.avatar} size={96} />
              <h1 className="display">{d.p1.name}</h1>
              <span className="mono" style={{ color: t.color }}>
                {t.name} · {d.p1.elo} · {d.p1.rw}/{d.p1.rp} real wins
              </span>
              <a className="mono small muted" href={solscanAccount(d.p1.wallet)} target="_blank" rel="noreferrer">
                wallet {short(d.p1.wallet)} ↗
              </a>
              <div className="challenge-terms">
                <div>
                  <span className="lbl">Length</span>
                  <b className="mono">{d.dur_ms / 60000} min</b>
                </div>
                <div>
                  <span className="lbl">Win condition</span>
                  <b>Highest ROI</b>
                </div>
                <div>
                  <span className="lbl">Stake</span>
                  <b>Bragging rights</b>
                </div>
              </div>
              {d.status !== "open" ? (
                <p className="muted">This challenge is {d.status}.</p>
              ) : mine ? (
                <div className="share">
                  <p className="small muted">Send this link to your opponent or post it. The duel starts 45 seconds after they accept.</p>
                  <div className="copy">
                    <input className="input mono" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
                    <button className="btn" onClick={() => navigator.clipboard?.writeText(link).then(() => toast("Link copied", "info"))}>
                      Copy
                    </button>
                  </div>
                  <div className="row-btns">
                    <a
                      className="btn btn-primary"
                      href={`https://x.com/intent/post?text=${encodeURIComponent(`1v1 me. ${d.dur_ms / 60000} minute real trading duel, my wallet vs yours, verified on-chain. Highest ROI wins.`)}&url=${encodeURIComponent(link)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Post on 𝕏
                    </a>
                    <button className="btn btn-ghost" onClick={cancel}>
                      Cancel challenge
                    </button>
                  </div>
                  <p className="small dim">Waiting for a taker…</p>
                </div>
              ) : (
                <div className="share">
                  {me?.wallet ? (
                    <button className="btn btn-primary big" onClick={accept} disabled={busy}>
                      {busy ? "Accepting…" : "Accept the duel"}
                    </button>
                  ) : (
                    <>
                      <p className="small muted">Verify your wallet to accept.</p>
                      <WalletConnect compact />
                    </>
                  )}
                  <p className="small dim">You will trade with the wallet on your profile. Only trades after the start count.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </>
    );
  }

  const s1 = d.score?.[0] ?? null;
  const s2 = d.score?.[1] ?? null;
  const pre = d.start != null && sNow < d.start;
  const left = d.end != null ? d.end - sNow : 0;
  const ended = d.status === "done" || left <= 0;
  const r1 = s1?.roi ?? 0;
  const r2 = s2?.roi ?? 0;
  const freshest = Math.max(0, ...Object.values(d.polled ?? {}));
  const youWon = d.status === "done" && d.me != null && d.winner === d.me;

  return (
    <>
      <div className="world" />
      <TopBar />
      <main className="page real-live">
        <div className="rl-head">
          <span className="eyebrow">
            <span className="chain-dot" /> Real duel · {d.dur_ms / 60000} min · verified on-chain
          </span>
          <div className={`rl-clock mono ${!pre && !ended && left < 60_000 ? "hot" : ""}`}>
            {d.status === "done" ? "FINAL" : pre ? `Starts in ${clock(d.start! - sNow)}` : ended ? "Settling…" : clock(left)}
          </div>
          <span className="small dim">
            {freshest ? `Chain sync ${age(sNow - freshest)} ago` : "Waiting for the first chain sync"}
          </span>
        </div>

        {d.status === "done" && (
          <div className={`rl-result ${youWon ? "win" : ""}`}>
            <b className="display">
              {d.winner === 0 ? "Draw" : `${d.winner === 1 ? d.p1.name : d.p2?.name} wins`}
            </b>
            {d.me != null && (
              <span className={`mono ${(d.elo[d.me - 1] ?? 0) >= 0 ? "t-up" : "t-down"}`}>{signed(d.elo[d.me - 1] ?? 0, 0)} rating</span>
            )}
          </div>
        )}

        {pre && (
          <div className="note">
            <b>Get ready.</b> Open your trading app with the wallet below. Trades made before the clock starts do not count.
          </div>
        )}

        <div className="rl-tug">
          <RoiTug a={r1} b={r2} />
        </div>

        <div className="rl-grid">
          <Side p={d.p1} s={s1} slot={1} d={d} lead={r1 >= r2} />
          <Side p={d.p2} s={s2} slot={2} d={d} lead={r2 > r1} />
        </div>
        <p className="small dim" style={{ marginTop: 12 }}>
          ROI = (sold + still held at the live price − bought) ÷ bought, over pump.fun bonding-curve trades inside the window. Buy at least 0.1 SOL to
          qualify.
        </p>
      </main>
    </>
  );
}

function RoiTug({ a, b }: { a: number; b: number }) {
  const diff = Math.max(-1, Math.min(1, a - b));
  const share = 50 + diff * 45;
  return (
    <div className="tug big">
      <div className="tug-a" style={{ width: `${share}%` }} />
      <div className="tug-b" style={{ width: `${100 - share}%` }} />
      <div className="tug-knot" style={{ left: `${share}%` }} />
    </div>
  );
}

function Side({ p, s, slot, d, lead }: { p: RealPlayer | null; s: RealScore | null; slot: number; d: RealDuelT; lead: boolean }) {
  const trades = d.trades.filter((t) => t[0] === slot);
  const t = tier(p?.elo ?? 1000);
  const ok = (s?.vol ?? 0) >= 0.1;
  const won = d.status === "done" && d.winner === slot;
  return (
    <div className={`panel rl-side ${lead ? "lead" : ""} ${won ? "won" : ""}`}>
      <div className="rl-who">
        <Avatar look={p?.avatar} size={44} />
        <div style={{ minWidth: 0 }}>
          <b>
            {p?.name}
            {d.me === slot && <span className="chip chip-you">YOU</span>}
          </b>
          <span className="mono small" style={{ color: t.color }}>
            {t.name} · {p?.elo}
          </span>
          {p?.wallet && (
            <a className="mono small muted" href={solscanAccount(p.wallet)} target="_blank" rel="noreferrer">
              {short(p.wallet)} ↗
            </a>
          )}
        </div>
      </div>
      <div className="rl-roi">
        <span className="lbl">ROI</span>
        <b className={`mono ${(s?.roi ?? 0) >= 0 ? "t-up" : "t-down"}`}>{s?.roi != null ? pct(s.roi * 100, 1) : "—"}</b>
        {!ok && <span className="chip chip-warn">needs 0.1 SOL bought</span>}
      </div>
      <div className="bag-split three">
        <div>
          <span className="lbl">PnL</span>
          <b className={`mono ${(s?.pnl ?? 0) >= 0 ? "t-up" : "t-down"}`}>{signed(s?.pnl ?? 0, 3)}</b>
        </div>
        <div>
          <span className="lbl">Bought</span>
          <b className="mono">{sol(s?.vol ?? 0, 2)}</b>
        </div>
        <div>
          <span className="lbl">Trades</span>
          <b className="mono">{s?.n ?? 0}</b>
        </div>
      </div>
      <div className="moves">
        {[...trades].reverse().slice(0, 12).map((x) => {
          const m = d.mints[x[1]];
          return (
            <a key={`${x[6]}-${x[5]}-${x[2]}`} className={`move ${x[2] === 1 ? "b" : "s"}`} href={solscanTx(x[6])} target="_blank" rel="noreferrer">
              <span className="mono">{x[2] === 1 ? "BUY" : "SELL"}</span>
              <b className="mono">{sol(x[3], 3)} SOL</b>
              <span className="mono dim">{m?.symbol ? `$${m.symbol.slice(0, 10)}` : short(x[1])}</span>
              <span className="mono dim">{d.start ? clock(x[5] - d.start) : ""}</span>
            </a>
          );
        })}
        {!trades.length && <p className="small dim">No trades yet.</p>}
      </div>
    </div>
  );
}
