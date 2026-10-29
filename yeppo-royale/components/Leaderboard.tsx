"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { pct } from "@/lib/format";
import { tier } from "@/lib/rank";
import { short } from "@/lib/wallet";
import type { User } from "@/lib/types";
import { useApp } from "./AppProvider";
import Avatar from "./Avatar";
import TopBar from "./TopBar";

type Sort = "elo" | "d_won" | "best_streak" | "r_won";
const SORTS: [Sort, string][] = [
  ["elo", "Rating"],
  ["d_won", "Wins"],
  ["best_streak", "Streak"],
  ["r_won", "Real wins"],
];

export default function Leaderboard() {
  const { me } = useApp();
  const [sort, setSort] = useState<Sort>("elo");
  const [rows, setRows] = useState<User[] | null>(null);

  useEffect(() => {
    let dead = false;
    setRows(null);
    supabase
      .from("yr_users")
      .select("id, handle, avatar, elo, d_played, d_won, d_lost, streak, best_streak, r_played, r_won, best_roi, wallet")
      .gt(sort === "r_won" ? "r_played" : "d_played", 0)
      .order(sort, { ascending: false })
      .order("elo", { ascending: false })
      .limit(100)
      .then(({ data }) => !dead && setRows((data as User[]) ?? []));
    return () => {
      dead = true;
    };
  }, [sort]);

  return (
    <>
      <div className="world" />
      <TopBar />
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="display">Leaderboard</h1>
            <p className="muted">Ranked by duel rating. Every duel moves it, against players and ghosts.</p>
          </div>
          <div className="seg">
            {SORTS.map(([k, l]) => (
              <button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {rows && rows.length >= 3 && (
          <div className="podium">
            {[1, 0, 2].map((i) => {
              const u = rows[i];
              const t = tier(u.elo);
              return (
                <div key={u.id} className={`pod p${i + 1}`}>
                  <span className="pod-rank mono">#{i + 1}</span>
                  <Avatar look={u.avatar} size={i === 0 ? 72 : 56} />
                  <b>{u.handle}</b>
                  <span className="mono" style={{ color: t.color }}>
                    {u.elo}
                  </span>
                  <span className="small dim mono">
                    {u.d_won}W · {u.d_lost}L
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
          <table className="lb">
            <thead>
              <tr>
                <th>#</th>
                <th>Trader</th>
                <th>Tier</th>
                <th className="num">Rating</th>
                <th className="num">W–L</th>
                <th className="num">Win rate</th>
                <th className="num">Best streak</th>
                <th className="num">Real</th>
                <th className="num">Best ROI</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((u, i) => {
                const t = tier(u.elo);
                const n = u.d_won + u.d_lost;
                return (
                  <tr key={u.id} className={u.id === me?.id ? "me" : ""}>
                    <td className="rank">{i + 1}</td>
                    <td>
                      <span className="who">
                        <Avatar look={u.avatar} size={22} />
                        {u.handle}
                        {u.wallet && (
                          <span className="chip chip-up" title={short(u.wallet)}>
                            ✓
                          </span>
                        )}
                      </span>
                    </td>
                    <td style={{ color: t.color, fontWeight: 600 }}>{t.name}</td>
                    <td className="num mono">{u.elo}</td>
                    <td className="num mono">
                      <span className="t-up">{u.d_won}</span>–<span className="t-down">{u.d_lost}</span>
                    </td>
                    <td className="num mono">{n ? `${((u.d_won / n) * 100).toFixed(0)}%` : "—"}</td>
                    <td className="num mono">{u.best_streak}</td>
                    <td className="num mono">
                      {u.r_won}/{u.r_played}
                    </td>
                    <td className="num mono">{u.best_roi != null ? pct(u.best_roi * 100, 1) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows && !rows.length && (
            <div className="center" style={{ minHeight: 200 }}>
              <p className="muted">No ranked players yet. Win a duel and take the #1 spot.</p>
            </div>
          )}
          {!rows && (
            <div className="center" style={{ minHeight: 200 }}>
              <i className="spinner" />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
