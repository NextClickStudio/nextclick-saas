"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { signed } from "@/lib/format";
import { level, tier } from "@/lib/rank";
import type { User } from "@/lib/types";
import { useApp } from "./AppProvider";
import Avatar from "./Avatar";
import TopBar from "./TopBar";

type Sort = "rp" | "wins" | "best_pnl";

export default function Leaderboard() {
  const { me } = useApp();
  const [sort, setSort] = useState<Sort>("rp");
  const [rows, setRows] = useState<User[] | null>(null);

  useEffect(() => {
    let dead = false;
    supabase
      .from("yr_users")
      .select("*")
      .gt("matches", 0)
      .order(sort, { ascending: false })
      .order("xp", { ascending: false })
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
          <h1 className="display">Leaderboard</h1>
          <div className="seg" style={{ width: 360 }}>
            {(
              [
                ["rp", "Rank points"],
                ["wins", "Wins"],
                ["best_pnl", "Best match"],
              ] as [Sort, string][]
            ).map(([k, l]) => (
              <button key={k} className={sort === k ? "on buy" : ""} onClick={() => setSort(k)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
          <table className="lb">
            <thead>
              <tr>
                <th>#</th>
                <th>Trader</th>
                <th>Tier</th>
                <th className="num">Level</th>
                <th className="num">Matches</th>
                <th className="num">Wins</th>
                <th className="num">Best</th>
                <th className="num">RP</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((u, i) => {
                const t = tier(u.rp);
                return (
                  <tr key={u.id} className={u.id === me?.id ? "me" : ""}>
                    <td className="rank display">{i + 1}</td>
                    <td>
                      <span className="who">
                        <Avatar look={u.avatar} size={34} />
                        {u.handle}
                      </span>
                    </td>
                    <td style={{ color: t.color, fontWeight: 800 }}>{t.name}</td>
                    <td className="num mono">{level(u.xp).lvl}</td>
                    <td className="num mono">{u.matches}</td>
                    <td className="num mono t-gold">{u.wins}</td>
                    <td className="num mono">{signed(u.best_pnl, 2)}</td>
                    <td className="num mono">{u.rp}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows && !rows.length && (
            <div className="center" style={{ minHeight: 200 }}>
              <p className="muted">No ranked players yet. Play a match and take the #1 spot.</p>
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
