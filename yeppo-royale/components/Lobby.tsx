"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { readLocal, rpc, writeLocal } from "@/lib/supabase";
import { clock } from "@/lib/format";
import { sfx, toast } from "@/lib/fx";
import { level, tier } from "@/lib/rank";
import type { Lobby as LobbyT, Mode } from "@/lib/types";
import { useApp } from "./AppProvider";
import Avatar from "./Avatar";
import TopBar from "./TopBar";

const LOCKED = [
  { id: "duos", name: "Duos", tagline: "Squad up with a friend. Shared bag." },
  { id: "ranked", name: "Ranked", tagline: "Climb tiers against real players only." },
  { id: "creative", name: "Creative", tagline: "Host your own room with your rules." },
];

export default function Lobby() {
  const router = useRouter();
  const { me, session, openCreator, ready } = useApp();
  const [lobby, setLobby] = useState<LobbyT | null>(null);
  const [skew, setSkew] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [modeId, setModeId] = useState("royale");
  const [picking, setPicking] = useState(false);
  const [joining, setJoining] = useState(false);
  const wantPlay = useRef(false);

  const load = useCallback(async () => {
    const t0 = Date.now();
    try {
      const l = await rpc<LobbyT>("yr_lobby", { p_secret: session?.secret ?? null });
      setSkew(l.now - (t0 + Date.now()) / 2);
      setLobby(l);
    } catch {
      /* keep the last lobby */
    }
  }, [session]);

  useEffect(() => {
    setModeId(readLocal("yr:mode", "royale"));
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const play = useCallback(async () => {
    if (!session) {
      wantPlay.current = true;
      openCreator(true);
      return;
    }
    setJoining(true);
    try {
      const r = await rpc<{ id: string }>("yr_join", { p_secret: session.secret, p_mode: modeId });
      sfx.go();
      router.push(`/play/${r.id}`);
    } catch (e) {
      sfx.error();
      toast(e instanceof Error ? e.message : "Could not join", "down");
      setJoining(false);
    }
  }, [session, modeId, openCreator, router]);

  // after creating a character from the PLAY button, drop straight in
  useEffect(() => {
    if (session && wantPlay.current) {
      wantPlay.current = false;
      void play();
    }
  }, [session, play]);

  const mode: Mode | undefined = lobby?.modes.find((m) => m.id === modeId) ?? lobby?.modes[0];
  const serverNow = now + skew;
  const nextIn = mode ? mode.next_start - serverNow : 0;
  const lv = level(me?.xp ?? 0);
  const t = tier(me?.rp ?? 0);
  const noArenas = lobby != null && lobby.arenas === 0;

  const milestones = me
    ? [
        { text: "Play 5 matches", v: me.matches, max: 5 },
        { text: "Survive 10 cuts", v: me.cuts_survived, max: 10 },
        { text: "Finish top 5", v: me.top5, max: 1 },
        { text: "Win a match", v: me.wins, max: 1 },
        { text: "Reach Gold", v: me.rp, max: 800 },
      ]
    : [];

  return (
    <>
      <div className="world" />
      <TopBar online={lobby?.online} />
      <main className="lobby">
        <section className="lobby-left">
          <div className="billboard">
            <span className="chip chip-gold">SEASON 0</span>
            <h3 className="display" style={{ marginTop: 10 }}>
              Spot the rug.
              <br />
              Ride the runner.
            </h3>
            <p>Every coin is a real pump.fun launch, replayed. Same coins for everyone. The worst bags get cut.</p>
          </div>
          <div className="panel">
            <div className="panel-head">
              <span className="lbl">How a match works</span>
            </div>
            <div className="steps">
              <div className="step">
                <b className="display">1</b>
                <span>Drop in with 10 play SOL. New coins launch every few seconds.</span>
              </div>
              <div className="step">
                <b className="display">2</b>
                <span>Read the intel: dev wallet, holders, snipers. Buy the runners, dodge the rugs.</span>
              </div>
              <div className="step">
                <b className="display">3</b>
                <span>Every cut, the poorest traders are eliminated. Last bag standing wins.</span>
              </div>
            </div>
          </div>
          {me && (
            <div className="panel">
              <div className="panel-head">
                <span className="lbl">Milestones</span>
              </div>
              {milestones.map((q) => (
                <div key={q.text} className="quest">
                  <div className="quest-top">
                    <span>{q.text}</span>
                    <em className="mono">
                      {Math.min(q.v, q.max)}/{q.max}
                    </em>
                  </div>
                  <div className="bar bar-gold">
                    <i style={{ width: `${Math.min(100, (q.v / q.max) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="stage">
          <div className="stage-glow" />
          <div className="stage-ring" />
          <div className="hero">
            <Avatar look={me?.avatar ?? { s: 0, e: 0, m: 0, h: 1, g: 1, o: 1, b: 0 }} size={300} />
          </div>
          <div className="nameplate">
            <h2 className="display">{me?.handle ?? (ready ? "New trencher" : " ")}</h2>
            <div className="sub">
              {me ? (
                <>
                  <span className="chip">LVL {lv.lvl}</span>
                  <span className="chip" style={{ color: t.color }}>
                    {t.name}
                  </span>
                  <span className="chip">{me.wins} wins</span>
                  <button className="chip" onClick={() => router.push("/locker")}>
                    ✏️ Edit
                  </button>
                </>
              ) : (
                <button className="btn btn-gold btn-sm" onClick={() => openCreator(true)}>
                  Create your character
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="lobby-right">
          {mode && (
            <div className={`mode-card ${mode.id}`}>
              <button className="btn btn-sm change" onClick={() => setPicking(true)}>
                Change
              </button>
              <span className="lbl" style={{ color: "#dfe4ff" }}>
                Selected mode
              </span>
              <h3 className="display">{mode.name}</h3>
              <p style={{ color: "#dfe4ff" }}>{mode.tagline}</p>
              <div className="meta">
                <span className="chip">{mode.size} traders</span>
                <span className="chip">{mode.cuts} cuts</span>
                <span className="chip">{Math.round(mode.dur_ms / 60000)} min</span>
                {mode.live > 0 && (
                  <span className="chip">
                    <i className="live-dot" /> {mode.live} live
                  </span>
                )}
              </div>
              <div className="next-drop">
                <span className="lbl" style={{ color: "#dfe4ff" }}>
                  Next drop
                </span>
                <span className="display mono">{clock(nextIn)}</span>
                {mode.queued > 0 && <span className="chip">{mode.queued} queued</span>}
              </div>
            </div>
          )}
          {lobby?.active ? (
            <button className="play-btn" onClick={() => router.push(`/play/${lobby.active!.id}`)}>
              Rejoin
              <small>YOUR MATCH IS LIVE</small>
            </button>
          ) : (
            <button className="play-btn" disabled={joining || noArenas || !lobby} onClick={play}>
              {joining ? "Joining…" : noArenas ? "Loading" : "Play"}
              <small>{noArenas ? "ARENAS WARMING UP: TRY AGAIN IN A FEW MINUTES" : session ? "DROP INTO THE NEXT MATCH" : "CREATE A CHARACTER AND DROP IN"}</small>
            </button>
          )}
        </section>
      </main>

      {picking && lobby && (
        <div className="modes-overlay" onClick={() => setPicking(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <h2 className="display" style={{ fontSize: 48, marginBottom: 16 }}>
              Select mode
            </h2>
            <div className="modes-grid">
              {lobby.modes.map((m) => (
                <div
                  key={m.id}
                  className={`mode-card ${m.id} ${m.id === mode?.id ? "sel" : ""}`}
                  onClick={() => {
                    sfx.tick();
                    setModeId(m.id);
                    writeLocal("yr:mode", m.id);
                    setPicking(false);
                  }}
                >
                  <h3 className="display">{m.name}</h3>
                  <p style={{ color: "#dfe4ff", marginTop: 6 }}>{m.tagline}</p>
                  <div className="meta">
                    <span className="chip">{m.size} traders</span>
                    <span className="chip">{Math.round(m.dur_ms / 60000)} min</span>
                  </div>
                  <div className="next-drop">
                    <span className="display mono">{clock(m.next_start - serverNow)}</span>
                  </div>
                </div>
              ))}
              {LOCKED.map((m) => (
                <div key={m.id} className="mode-card locked">
                  <span className="chip chip-gold">COMING SOON</span>
                  <h3 className="display" style={{ marginTop: 8 }}>
                    {m.name}
                  </h3>
                  <p style={{ color: "#dfe4ff", marginTop: 6 }}>{m.tagline}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
