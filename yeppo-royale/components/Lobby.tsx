"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { readLocal, rpc, supabase, writeLocal } from "@/lib/supabase";
import { clock, signed } from "@/lib/format";
import { sfx, toast } from "@/lib/fx";
import { level, tier } from "@/lib/rank";
import type { Lobby as LobbyT, User } from "@/lib/types";
import { useApp } from "./AppProvider";
import Avatar from "./Avatar";
import TopBar from "./TopBar";

const LOCKED = [
  { id: "duos", name: "Duos", tagline: "Squad up with a friend, shared bag." },
  { id: "ranked", name: "Ranked", tagline: "Real players only, tiered matchmaking." },
  { id: "custom", name: "Custom rooms", tagline: "Host a room with your own rules." },
];

export default function Lobby() {
  const router = useRouter();
  const { me, session, openCreator, ready } = useApp();
  const [lobby, setLobby] = useState<LobbyT | null>(null);
  const [top, setTop] = useState<User[]>([]);
  const [skew, setSkew] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [modeId, setModeId] = useState("royale");
  const [joining, setJoining] = useState<string | null>(null);
  const wantPlay = useRef<string | null>(null);

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
    supabase
      .from("yr_users")
      .select("*")
      .gt("matches", 0)
      .order("rp", { ascending: false })
      .limit(8)
      .then(({ data }) => setTop((data as User[]) ?? []));
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

  const play = useCallback(
    async (mode: string) => {
      setModeId(mode);
      writeLocal("yr:mode", mode);
      if (!session) {
        wantPlay.current = mode;
        openCreator(true);
        return;
      }
      setJoining(mode);
      try {
        const r = await rpc<{ id: string }>("yr_join", { p_secret: session.secret, p_mode: mode });
        sfx.go();
        router.push(`/play/${r.id}`);
      } catch (e) {
        sfx.error();
        toast(e instanceof Error ? e.message : "Could not join", "down");
        setJoining(null);
      }
    },
    [session, openCreator, router],
  );

  // after creating a character from a Join button, drop straight in
  useEffect(() => {
    if (session && wantPlay.current) {
      const m = wantPlay.current;
      wantPlay.current = null;
      void play(m);
    }
  }, [session, play]);

  const serverNow = now + skew;
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
        <aside className="lobby-col">
          <div className="panel profile">
            <div className="profile-top">
              <Avatar look={me?.avatar ?? { b: 0, s: 0, e: 0, m: 1, h: 0, g: 0, o: 0 }} size={56} />
              <div style={{ minWidth: 0 }}>
                <h2 className="display">{me?.handle ?? (ready ? "Guest" : " ")}</h2>
                {me ? (
                  <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    <span className="chip" style={{ color: t.color }}>
                      {t.name}
                    </span>
                    <span className="chip mono">LVL {lv.lvl}</span>
                  </div>
                ) : (
                  <span className="muted small">Create a profile to play</span>
                )}
              </div>
            </div>
            {me ? (
              <>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span className="lbl">Level {lv.lvl}</span>
                    <span className="mono small dim">
                      {lv.into}/{lv.need} XP
                    </span>
                  </div>
                  <div className="bar">
                    <i style={{ width: `${lv.pct}%` }} />
                  </div>
                </div>
                <div className="kv-grid">
                  <div>
                    <span className="lbl">Matches</span>
                    <b className="mono">{me.matches}</b>
                  </div>
                  <div>
                    <span className="lbl">Wins</span>
                    <b className="mono">{me.wins}</b>
                  </div>
                  <div>
                    <span className="lbl">RP</span>
                    <b className="mono">{me.rp}</b>
                  </div>
                </div>
                <Link href="/locker" className="btn btn-sm">
                  Edit profile picture
                </Link>
              </>
            ) : (
              <button className="btn btn-gold" onClick={() => openCreator(true)}>
                Create profile
              </button>
            )}
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
        </aside>

        <section className="lobby-col">
          {lobby?.active && (
            <div className="active-banner">
              <span>
                <b>You are in a live match.</b> <span className="muted">Your bag is waiting.</span>
              </span>
              <button className="btn btn-gold btn-sm" onClick={() => router.push(`/play/${lobby.active!.id}`)}>
                Rejoin
              </button>
            </div>
          )}
          <div className="lobby-head">
            <div>
              <h1 className="display">Select a mode</h1>
              <p className="muted" style={{ marginTop: 2 }}>
                Same real pump.fun launches for everyone. Every cut, the smallest bags are eliminated.
              </p>
            </div>
            {lobby && <span className="chip mono">{lobby.arenas} arenas ready</span>}
          </div>
          <div className="mode-list">
            {(lobby?.modes ?? []).map((m) => {
              const nextIn = m.next_start - serverNow;
              return (
                <div key={m.id} className={`mode-row ${m.id === modeId ? "sel" : ""}`}>
                  <div>
                    <h3>{m.name}</h3>
                    <p>{m.tagline}</p>
                    <div className="meta">
                      <span className="chip">{m.size} traders</span>
                      <span className="chip">{m.cuts} cuts</span>
                      <span className="chip">{Math.round(m.dur_ms / 60000)} min</span>
                      <span className="chip">10 SOL start</span>
                      {m.live > 0 && (
                        <span className="chip chip-down">
                          <i className="live-dot" /> {m.live} live
                        </span>
                      )}
                      {m.queued > 0 && <span className="chip chip-up">{m.queued} queued</span>}
                    </div>
                  </div>
                  <div className="drop">
                    <span className="lbl">Next drop</span>
                    <span className="mono">{clock(nextIn)}</span>
                  </div>
                  <button className="play-btn" disabled={!!joining || noArenas || !!lobby?.active} onClick={() => play(m.id)}>
                    {joining === m.id ? "Joining…" : noArenas ? "Warming up" : "Join"}
                    <small>{session ? "drop in" : "create profile"}</small>
                  </button>
                </div>
              );
            })}
            {!lobby && (
              <div className="panel center" style={{ minHeight: 160 }}>
                <i className="spinner" />
              </div>
            )}
            {LOCKED.map((m) => (
              <div key={m.id} className="mode-row locked">
                <div>
                  <h3>{m.name}</h3>
                  <p>{m.tagline}</p>
                </div>
                <div className="drop">
                  <span className="lbl">Status</span>
                  <span className="small">Coming soon</span>
                </div>
                <button className="play-btn" disabled>
                  Soon
                </button>
              </div>
            ))}
          </div>
          {noArenas && (
            <div className="note">
              <b>Arenas are being built.</b> Every arena is made of launches recorded live from pump.fun over the last hours. The first ones are ready a few minutes after
              launch.
            </div>
          )}
        </section>

        <aside className="lobby-col right">
          <div className="panel">
            <div className="panel-head">
              <span className="lbl">How it works</span>
            </div>
            <div className="steps">
              <div className="step">
                <b>1</b>
                <span>Drop in with 10 play SOL. Real pump.fun launches replay at speed, under codenames.</span>
              </div>
              <div className="step">
                <b>2</b>
                <span>Read the intel: dev wallet, holders, snipers, flow. Buy runners, avoid rugs.</span>
              </div>
              <div className="step">
                <b>3</b>
                <span>At every cut the smallest bags are eliminated. Last bag standing wins.</span>
              </div>
              <div className="step">
                <b>4</b>
                <span>After the match the real coins are revealed. Earn XP and rank points.</span>
              </div>
            </div>
          </div>
          <div className="panel mini-lb">
            <div className="panel-head">
              <span className="lbl">Top traders</span>
              <Link href="/leaderboard" className="small muted">
                View all
              </Link>
            </div>
            {top.length ? (
              top.map((u, i) => (
                <div key={u.id} className="row">
                  <span className="mono dim">{i + 1}</span>
                  <Avatar look={u.avatar} size={22} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.handle}</span>
                  <span className="mono small">{u.rp} RP</span>
                </div>
              ))
            ) : (
              <p className="muted small">No ranked traders yet. The first win takes #1.</p>
            )}
          </div>
          {me && me.best_pnl > 0 && (
            <div className="note">
              Best match so far: <b className="mono t-up">{signed(me.best_pnl, 2)} SOL</b>
            </div>
          )}
        </aside>
      </main>
    </>
  );
}
