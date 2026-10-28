"use client";

import { useState } from "react";
import { signed } from "@/lib/format";
import { toast } from "@/lib/fx";
import { level, tier, TIERS } from "@/lib/rank";
import { useApp } from "./AppProvider";
import Avatar from "./Avatar";
import TopBar from "./TopBar";

export default function Career() {
  const { me, session, logout, openCreator, ready } = useApp();
  const [showKey, setShowKey] = useState(false);
  if (!me || !session) {
    return (
      <>
        <div className="world" />
        <TopBar />
        <main className="page">
          {ready && (
            <div className="panel center" style={{ minHeight: 300 }}>
              <div>
                <p className="display" style={{ fontSize: 32 }}>
                  Create a character to start your career
                </p>
                <button className="btn btn-gold" style={{ marginTop: 12 }} onClick={() => openCreator(true)}>
                  Create character
                </button>
              </div>
            </div>
          )}
        </main>
      </>
    );
  }
  const lv = level(me.xp);
  const t = tier(me.rp);
  return (
    <>
      <div className="world" />
      <TopBar />
      <main className="page">
        <div className="page-head">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar look={me.avatar} size={86} />
            <div>
              <h1 className="display">{me.handle}</h1>
              <span className="muted">
                Level {lv.lvl} · <span style={{ color: t.color }}>{t.name}</span> · {me.rp} RP
              </span>
            </div>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat">
            <span className="lbl">Matches</span>
            <b className="display mono">{me.matches}</b>
          </div>
          <div className="stat">
            <span className="lbl">Wins</span>
            <b className="display mono t-gold">{me.wins}</b>
          </div>
          <div className="stat">
            <span className="lbl">Top 5</span>
            <b className="display mono">{me.top5}</b>
          </div>
          <div className="stat">
            <span className="lbl">Cuts survived</span>
            <b className="display mono">{me.cuts_survived}</b>
          </div>
          <div className="stat">
            <span className="lbl">Best match</span>
            <b className={`display mono ${me.best_pnl > 0 ? "t-up" : ""}`}>{signed(me.best_pnl, 2)} SOL</b>
          </div>
          <div className="stat">
            <span className="lbl">Win rate</span>
            <b className="display mono">{me.matches ? `${((me.wins / me.matches) * 100).toFixed(0)}%` : "—"}</b>
          </div>
          <div className="stat">
            <span className="lbl">Level</span>
            <b className="display mono">{lv.lvl}</b>
            <div className="bar" style={{ marginTop: 8 }}>
              <i style={{ width: `${lv.pct}%` }} />
            </div>
            <span className="small muted">
              {lv.into}/{lv.need} XP
            </span>
          </div>
          <div className="stat">
            <span className="lbl">Tier</span>
            <b className="display" style={{ color: t.color }}>
              {t.name}
            </b>
            <div className="bar bar-gold" style={{ marginTop: 8 }}>
              <i style={{ width: `${t.pct}%` }} />
            </div>
            <span className="small muted">{t.next ? `${t.next.min - me.rp} RP to ${t.next.name}` : "Top tier"}</span>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head">
            <span className="lbl">Tiers</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TIERS.map((x) => (
              <span key={x.name} className="chip" style={{ color: x.color, outline: x.name === t.name ? `1px solid ${x.color}` : undefined }}>
                {x.name} · {x.min} RP
              </span>
            ))}
          </div>
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head">
            <span className="lbl">Account key</span>
          </div>
          <p className="muted small">This key is your login on other devices. Anyone who has it controls your character, so keep it private.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <input className="input mono" style={{ flex: 1, minWidth: 220, fontSize: 12 }} readOnly value={showKey ? session.secret : "•".repeat(32)} />
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
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
