"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePrices } from "@/lib/market";
import { botLive, strategyLabel } from "@/lib/bots";
import { compact, pct, pts, tone } from "@/lib/format";
import { normUser, type UserStats } from "@/lib/types";
import { useApp } from "./AppProvider";
import { BotAvatar } from "./ui";

type Tab = "traders" | "bots" | "creators";
const MEDAL = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const { bots, me } = useApp();
  const prices = usePrices();
  const [tab, setTab] = useState<Tab>("traders");
  const [users, setUsers] = useState<UserStats[] | null>(null);

  useEffect(() => {
    const load = () =>
      supabase
        .from("bm_users_v")
        .select("*")
        .eq("is_house", false)
        .order("net_worth", { ascending: false })
        .limit(100)
        .then(({ data }) => data && setUsers(data.map(normUser)));
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const botRows = useMemo(() => Object.values(bots).map((b) => ({ b, ...botLive(b, prices) })).sort((a, b) => b.ret - a.ret), [bots, prices]);
  const creators = useMemo(() => {
    const m = new Map<string, { handle: string; bots: number; mcap: number; holders: number; paid: number }>();
    for (const r of botRows) {
      const k = r.b.creator ?? "?";
      const c = m.get(k) ?? { handle: k, bots: 0, mcap: 0, holders: 0, paid: 0 };
      c.bots += 1;
      c.mcap += r.mcap;
      c.holders += r.b.holders;
      c.paid += r.b.dividends_paid;
      m.set(k, c);
    }
    return [...m.values()].sort((a, b) => b.mcap - a.mcap || b.paid - a.paid);
  }, [botRows]);

  return (
    <main className="page board">
      <div className="mk-head">
        <div>
          <h1>Leaderboard</h1>
          <p className="muted">Who backs the best bots, which bots print, who builds them.</p>
        </div>
        <div className="seg">
          {(["traders", "bots", "creators"] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="tbl-wrap">
          {tab === "traders" && (
            <table className="tbl">
              <thead>
                <tr>
                  <th className="c-rank">#</th>
                  <th>Trader</th>
                  <th className="num">Net worth</th>
                  <th className="num c-hide">Balance</th>
                  <th className="num c-hide">In shares</th>
                  <th className="num">Dividends</th>
                  <th className="num c-hide">Bots</th>
                </tr>
              </thead>
              <tbody>
                {(users ?? []).map((u, i) => (
                  <tr key={u.id} className={me?.id === u.id ? "me" : ""}>
                    <td className="c-rank mono">{MEDAL[i] ?? i + 1}</td>
                    <td>
                      @{u.handle}
                      {me?.id === u.id && <span className="tag tag-you">YOU</span>}
                    </td>
                    <td className="num mono">{pts(u.net_worth)}</td>
                    <td className="num mono c-hide">{pts(u.balance)}</td>
                    <td className="num mono c-hide">{pts(u.holdings_value)}</td>
                    <td className="num mono t-gold">{pts(u.dividends)}</td>
                    <td className="num mono c-hide">{u.bots}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "traders" && users && !users.length && <div className="empty">No traders yet. Sign up and take #1.</div>}

          {tab === "bots" && (
            <table className="tbl">
              <thead>
                <tr>
                  <th className="c-rank">#</th>
                  <th>Bot</th>
                  <th className="c-strat">Strategy</th>
                  <th className="num">Return</th>
                  <th className="num c-hide">Win rate</th>
                  <th className="num">Dividends paid</th>
                  <th className="num c-hide">Mcap</th>
                </tr>
              </thead>
              <tbody>
                {botRows.map((x, i) => (
                  <tr key={x.b.id}>
                    <td className="c-rank mono">{MEDAL[i] ?? i + 1}</td>
                    <td>
                      <Link href={`/bot/${x.b.ticker}`} className="botcell">
                        <BotAvatar bot={x.b} />
                        <div>
                          <b className="botname">{x.b.name}</b>
                          <span className="botmeta mono">${x.b.ticker}</span>
                        </div>
                      </Link>
                    </td>
                    <td className="c-strat muted">
                      <span className="tag">{x.b.asset}</span> {strategyLabel(x.b)}
                    </td>
                    <td className={`num mono t-${tone(x.ret)}`}>{pct(x.ret)}</td>
                    <td className="num mono c-hide">{x.winRate == null ? "—" : `${x.winRate.toFixed(0)}%`}</td>
                    <td className="num mono t-gold">{pts(x.b.dividends_paid)}</td>
                    <td className="num mono c-hide">{compact(x.mcap)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "creators" && (
            <table className="tbl">
              <thead>
                <tr>
                  <th className="c-rank">#</th>
                  <th>Creator</th>
                  <th className="num">Bots</th>
                  <th className="num">Total mcap</th>
                  <th className="num c-hide">Holders</th>
                  <th className="num">Dividends paid</th>
                </tr>
              </thead>
              <tbody>
                {creators.map((c, i) => (
                  <tr key={c.handle}>
                    <td className="c-rank mono">{MEDAL[i] ?? i + 1}</td>
                    <td>@{c.handle}</td>
                    <td className="num mono">{c.bots}</td>
                    <td className="num mono">{compact(c.mcap)}</td>
                    <td className="num mono c-hide">{c.holders}</td>
                    <td className="num mono t-gold">{pts(c.paid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
