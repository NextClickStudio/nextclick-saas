"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ASSET_LIST, usePrices } from "@/lib/market";
import { botLive, strategyLabel } from "@/lib/bots";
import { compact, pct, pts, sharePrice, tone } from "@/lib/format";
import { readLocal, writeLocal } from "@/lib/supabase";
import type { Asset } from "@/lib/strategy";
import { useApp } from "./AppProvider";
import Feed from "./Feed";
import { BotAvatar, Flash, PositionCell, Spark, Stat } from "./ui";

type Tab = "trending" | "top" | "live" | "new" | "held";
const TABS: { id: Tab; label: string }[] = [
  { id: "trending", label: "Trending" },
  { id: "top", label: "Top return" },
  { id: "live", label: "In position" },
  { id: "new", label: "New" },
  { id: "held", label: "Most held" },
];

export default function Markets() {
  const router = useRouter();
  const { bots, botsReady, curves, activity, session, openAuth } = useApp();
  const prices = usePrices();
  const [tab, setTab] = useState<Tab>("trending");
  const [asset, setAsset] = useState<Asset | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [intro, setIntro] = useState(true);
  useEffect(() => setIntro(!readLocal("bm:intro-closed", false)), []);

  const rows = useMemo(() => Object.values(bots).map((b) => ({ b, ...botLive(b, prices) })), [bots, prices]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^\$/, "");
    let r = rows.filter(
      (x) =>
        (asset === "ALL" || x.b.asset === asset) &&
        (!needle || x.b.ticker.toLowerCase().includes(needle) || x.b.name.toLowerCase().includes(needle) || (x.b.creator ?? "").toLowerCase().includes(needle)),
    );
    if (tab === "live") r = r.filter((x) => x.b.position);
    const sorters: Record<Tab, (a: (typeof r)[number], b: (typeof r)[number]) => number> = {
      trending: (a, b) => (b.b.volume_24h ?? 0) - (a.b.volume_24h ?? 0) || b.mcap - a.mcap || b.ret - a.ret,
      top: (a, b) => b.ret - a.ret,
      live: (a, b) => (b.open?.pct ?? 0) - (a.open?.pct ?? 0),
      new: (a, b) => Date.parse(b.b.created_at) - Date.parse(a.b.created_at),
      held: (a, b) => b.b.holders - a.b.holders || b.mcap - a.mcap,
    };
    return [...r].sort(sorters[tab]);
  }, [rows, tab, asset, q]);

  const totals = useMemo(
    () => ({
      bots: rows.length,
      live: rows.filter((x) => x.b.position).length,
      paid: rows.reduce((s, x) => s + x.b.dividends_paid, 0),
      mcap: rows.reduce((s, x) => s + x.mcap, 0),
    }),
    [rows],
  );

  return (
    <main className="page markets">
      <section className="mk-main">
        {intro && (
          <div className="intro">
            <div className="intro-steps">
              <span>
                <b>1</b> Bots trade real BTC, ETH, SOL… with paper money, 24/7
              </span>
              <span>
                <b>2</b> Buy shares early on the curve — price rises as others buy
              </span>
              <span>
                <b>3</b> Every winning trade pays dividends to holders
              </span>
            </div>
            <div className="intro-cta">
              {!session && (
                <button className="btn btn-primary btn-xs" onClick={() => openAuth("signup")}>
                  Get 10,000 pts
                </button>
              )}
              <Link href="/launch" className="btn btn-ghost btn-xs">
                Launch a bot
              </Link>
              <button
                className="icon-btn"
                aria-label="Hide intro"
                onClick={() => {
                  setIntro(false);
                  writeLocal("bm:intro-closed", true);
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="mk-head">
          <div>
            <h1>Markets</h1>
            <p className="muted">The stock market for trading bots. Real prices, paper money, real-time PnL.</p>
          </div>
          <div className="mk-stats">
            <Stat label="Bots">{totals.bots}</Stat>
            <Stat label="In position" tone="up">
              {totals.live}
            </Stat>
            <Stat label="Dividends paid" tone="gold">
              {compact(totals.paid)}
            </Stat>
            <Stat label="Market cap">{compact(totals.mcap)}</Stat>
          </div>
        </div>

        <div className="toolbar">
          <div className="seg">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="chips">
            <button className={asset === "ALL" ? "on" : ""} onClick={() => setAsset("ALL")}>
              All
            </button>
            {ASSET_LIST.map((a) => (
              <button key={a} className={asset === a ? "on" : ""} onClick={() => setAsset(a)}>
                {a}
              </button>
            ))}
          </div>
          <input className="input input-sm search" placeholder="Search bot, $ticker, @creator" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th className="c-rank">#</th>
                <th>Bot</th>
                <th className="c-strat">Strategy</th>
                <th>Position</th>
                <th className="num">Return</th>
                <th className="num c-hide">Win rate</th>
                <th className="num c-hide">Trades</th>
                <th className="num">Price</th>
                <th className="num c-24">24h</th>
                <th className="num c-hide">Mcap</th>
                <th className="num c-hide">Holders</th>
                <th className="c-spark c-hide">Equity</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x, i) => (
                <tr key={x.b.id} onClick={() => router.push(`/bot/${x.b.ticker}`)} className={x.b.status === "rekt" ? "rekt" : ""}>
                  <td className="c-rank mono">{i + 1}</td>
                  <td>
                    <div className="botcell">
                      <BotAvatar bot={x.b} />
                      <div>
                        <Link href={`/bot/${x.b.ticker}`} onClick={(e) => e.stopPropagation()} className="botname">
                          {x.b.name}
                        </Link>
                        <span className="botmeta">
                          <span className="mono">${x.b.ticker}</span> · @{x.b.creator ?? "—"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="c-strat">
                    <span className="tag">{x.b.asset}</span> <span className="muted">{strategyLabel(x.b)}</span>
                  </td>
                  <td>
                    <PositionCell bot={x.b} open={x.open} />
                  </td>
                  <td className={`num mono t-${tone(x.ret)}`}>
                    <Flash value={x.ret}>{pct(x.ret)}</Flash>
                  </td>
                  <td className="num mono c-hide">{x.winRate == null ? "—" : `${x.winRate.toFixed(0)}%`}</td>
                  <td className="num mono c-hide">{x.b.trades}</td>
                  <td className="num mono">
                    <Flash value={x.price}>{sharePrice(x.price)}</Flash>
                  </td>
                  <td className={`num mono c-24 t-${tone(x.chg24)}`}>{pct(x.chg24, 1)}</td>
                  <td className="num mono c-hide">{compact(x.mcap)}</td>
                  <td className="num mono c-hide">{x.b.holders}</td>
                  <td className="c-spark c-hide">
                    <Spark points={[...(curves[x.b.id] ?? [x.b.capital]), x.equity]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <div className="empty">{botsReady ? "No bots match." : "Loading market…"}</div>}
        </div>
        <p className="foot muted">
          Paper trading on Binance public prices · pts have no cash value · not financial advice ·{" "}
          <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
            Charts by TradingView
          </a>
        </p>
      </section>
      <aside className="mk-side">
        <TopPayers />
        <Feed items={activity} />
      </aside>
    </main>
  );
}

function TopPayers() {
  const { bots } = useApp();
  const top = useMemo(
    () =>
      Object.values(bots)
        .filter((b) => b.dividends_paid > 0)
        .sort((a, b) => b.dividends_paid - a.dividends_paid)
        .slice(0, 5),
    [bots],
  );
  if (!top.length) return null;
  return (
    <section className="panel payers">
      <div className="panel-head">
        <span className="lbl">Top dividend payers</span>
      </div>
      {top.map((b) => (
        <Link key={b.id} href={`/bot/${b.ticker}`} className="payer">
          <span className="mono">{b.emoji}</span>
          <b>${b.ticker}</b>
          <span className="mono t-gold">{pts(b.dividends_paid)}</span>
        </Link>
      ))}
    </section>
  );
}
