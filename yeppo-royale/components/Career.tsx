"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { rpc } from "@/lib/supabase";
import { age, pct, signed } from "@/lib/format";
import { toast } from "@/lib/fx";
import { level, tier, TIERS } from "@/lib/rank";
import { useApp } from "./AppProvider";
import Avatar from "./Avatar";
import TopBar from "./TopBar";
import WalletConnect from "./WalletConnect";

type MyDuel = { id: string; ended: number; me: number; s1: number; s2: number; winner: number; delta: number | null; opp: string; opp_avatar: unknown; ghost: boolean };

export default function Career() {
  const { me, session, logout, openCreator, ready } = useApp();
  const [showKey, setShowKey] = useState(false);
  const [duels, setDuels] = useState<MyDuel[] | null>(null);

  useEffect(() => {
    if (!session) return;
    rpc<MyDuel[]>("yr_my_duels", { p_secret: session.secret }).then(setDuels, () => setDuels([]));
  }, [session, me?.d_played]);

  if (!me || !session) {
    return (
      <>
        <div className="world" />
        <TopBar />
        <main className="page">
          {ready && (
            <div className="panel center" style={{ minHeight: 300 }}>
              <div>
                <p className="display" style={{ fontSize: 16 }}>
                  Create a profile to start dueling
                </p>
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => openCreator(true)}>
                  Create profile
                </button>
              </div>
            </div>
          )}
        </main>
      </>
    );
  }
  const lv = level(me.xp);
  const t = tier(me.elo);
  const played = me.d_won + me.d_lost;

  return (
    <>
      <div className="world" />
      <TopBar />
      <main className="page profile-page">
        <section className="pf-head panel">
          <div className="pf-av">
            <Avatar look={me.avatar} size={96} />
            <Link href="/locker" className="btn btn-sm">
              Edit picture
            </Link>
          </div>
          <div className="pf-id">
            <h1 className="display">{me.handle}</h1>
            <div className="me-tags">
              <span className="chip" style={{ color: t.color }}>
                {t.name}
              </span>
              <span className="chip mono">Level {lv.lvl}</span>
              {me.wallet && <span className="chip chip-up">✓ Verified wallet</span>}
            </div>
            <div className="pf-tier">
              <div className="bar">
                <i style={{ width: `${t.pct}%`, background: t.color }} />
              </div>
              <span className="small muted">{t.next ? `${t.next.min - me.elo} rating to ${t.next.name}` : "Top tier"}</span>
            </div>
          </div>
          <div className="pf-elo">
            <span className="lbl">Rating</span>
            <b className="mono" style={{ color: t.color }}>
              {me.elo}
            </b>
          </div>
        </section>

        <div className="stat-grid">
          <Stat label="Duels won" v={String(me.d_won)} cls="t-up" />
          <Stat label="Duels lost" v={String(me.d_lost)} cls="t-down" />
          <Stat label="Win rate" v={played ? `${((me.d_won / played) * 100).toFixed(0)}%` : "—"} />
          <Stat label="Streak · best" v={`${me.streak} · ${me.best_streak}`} />
          <Stat label="Real duels won" v={`${me.r_won}/${me.r_played}`} />
          <Stat label="Best real ROI" v={me.best_roi != null ? pct(me.best_roi * 100, 1) : "—"} cls={(me.best_roi ?? 0) > 0 ? "t-up" : ""} />
          <Stat label="XP" v={`${lv.into}/${lv.need}`} bar={lv.pct} />
          <Stat label="Level" v={String(lv.lvl)} />
        </div>

        <div className="pf-grid">
          <div className="panel">
            <div className="panel-head">
              <span className="lbl">Recent duels</span>
            </div>
            {(duels ?? []).map((x) => {
              const won = x.winner === x.me;
              const mine = x.me === 1 ? x.s1 : x.s2;
              const theirs = x.me === 1 ? x.s2 : x.s1;
              return (
                <Link key={x.id} href={`/duel/${x.id}`} className="hist-row">
                  <span className={`res ${won ? "won" : x.winner === 0 ? "draw" : "lost"}`}>{won ? "W" : x.winner === 0 ? "D" : "L"}</span>
                  <Avatar look={x.opp_avatar} size={22} />
                  <span className="nm">
                    {x.opp}
                    {x.ghost && <span className="chip chip-ghost">GHOST</span>}
                  </span>
                  <span className="mono">
                    {mine}–{theirs}
                  </span>
                  <span className={`mono small ${(x.delta ?? 0) >= 0 ? "t-up" : "t-down"}`}>{x.delta != null ? signed(x.delta, 0) : ""}</span>
                  <span className="small dim">{age(Date.now() - x.ended)}</span>
                </Link>
              );
            })}
            {duels && !duels.length && <p className="small muted">No duels yet. Your history shows up here.</p>}
          </div>

          <div className="pf-col">
            <div className="panel">
              <div className="panel-head">
                <span className="lbl">Wallet for real duels</span>
              </div>
              <WalletConnect />
            </div>
            <div className="panel">
              <div className="panel-head">
                <span className="lbl">Tiers</span>
              </div>
              <div className="tiers">
                {TIERS.map((x) => (
                  <span key={x.name} className={`chip ${x.name === t.name ? "on" : ""}`} style={{ color: x.color, outlineColor: x.color }}>
                    {x.name} · {x.min}
                  </span>
                ))}
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">
                <span className="lbl">Account key</span>
              </div>
              <p className="muted small">This key logs you in on other devices. Anyone who has it controls your profile, so keep it private.</p>
              <div className="copy" style={{ marginTop: 8 }}>
                <input className="input mono" readOnly value={showKey ? session.secret : "•".repeat(32)} />
                <button className="btn btn-sm" onClick={() => setShowKey((s) => !s)}>
                  {showKey ? "Hide" : "Reveal"}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() =>
                    navigator.clipboard?.writeText(session.secret).then(
                      () => toast("Key copied", "info"),
                      () => setShowKey(true),
                    )
                  }
                >
                  Copy
                </button>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={logout}>
                Log out
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function Stat({ label, v, cls, bar }: { label: string; v: string; cls?: string; bar?: number }) {
  return (
    <div className="stat">
      <span className="lbl">{label}</span>
      <b className={`mono ${cls ?? ""}`}>{v}</b>
      {bar != null && (
        <div className="bar" style={{ marginTop: 8 }}>
          <i style={{ width: `${bar}%` }} />
        </div>
      )}
    </div>
  );
}
