"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase, rpc } from "@/lib/supabase";
import { fetchKlines, usePrices } from "@/lib/market";
import { botLive, openPnl, strategyLabel } from "@/lib/bots";
import { priceAt, ptsForShares, sharesForPts } from "@/lib/curve";
import { ago, assetPrice, compact, duration, pct, pts, sharePrice, signed, tone, usd } from "@/lib/format";
import { backtest, describe, STRATEGIES, TF_MS, type BotConfig } from "@/lib/strategy";
import { centerOf, confetti, edgeGlow, floatText, sfx, toast } from "@/lib/fx";
import { normBot, type Bot, type BotTrade, type ShareTrade } from "@/lib/types";
import { useApp } from "./AppProvider";
import AssetChart, { type Line, type Mark } from "./AssetChart";
import { BotAvatar, Flash, PositionCell, Stat } from "./ui";

type Tab = "trades" | "strategy" | "holders" | "shares";

export default function BotView({ ticker }: { ticker: string }) {
  const { bots, botsReady } = useApp();
  const fromStore = useMemo(() => Object.values(bots).find((b) => b.ticker === ticker) ?? null, [bots, ticker]);
  const [fetched, setFetched] = useState<Bot | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (fromStore || !botsReady) return;
    supabase
      .from("bm_bots_v")
      .select("*")
      .eq("ticker", ticker)
      .maybeSingle()
      .then(({ data }) => (data ? setFetched(normBot(data)) : setMissing(true)));
  }, [fromStore, botsReady, ticker]);

  const bot = fromStore ?? fetched;
  if (missing && !bot) {
    return (
      <main className="page center">
        <h1>${ticker} not found</h1>
        <Link href="/" className="btn btn-ghost">
          Back to markets
        </Link>
      </main>
    );
  }
  if (!bot) {
    return (
      <main className="page center">
        <i className="spinner" />
      </main>
    );
  }
  return <BotPage bot={bot} />;
}

function BotPage({ bot }: { bot: Bot }) {
  const prices = usePrices();
  const live = botLive(bot, prices);
  const [tab, setTab] = useState<Tab>("trades");
  const [trades, setTrades] = useState<BotTrade[]>([]);
  const [shares, setShares] = useState<ShareTrade[]>([]);
  const [holders, setHolders] = useState<{ handle: string; shares: number; dividends: number }[]>([]);

  useEffect(() => {
    supabase
      .from("bm_bot_trades")
      .select("*")
      .eq("bot_id", bot.id)
      .order("id", { ascending: false })
      .limit(200)
      .then(({ data }) => data && setTrades(data.map((t) => ({ ...t, entry: +t.entry, exit: +t.exit, pnl_usd: +t.pnl_usd, pnl_pct: +t.pnl_pct, dividend: +t.dividend }) as BotTrade)));
  }, [bot.id, bot.trades]);

  useEffect(() => {
    supabase
      .from("bm_share_trades")
      .select("*")
      .eq("bot_id", bot.id)
      .order("id", { ascending: false })
      .limit(400)
      .then(({ data }) => data && setShares(data.map((t) => ({ ...t, shares: +t.shares, pts: +t.pts, price: +t.price, supply_after: +t.supply_after }) as ShareTrade)));
    supabase
      .from("bm_holdings")
      .select("shares,dividends,bm_users(handle)")
      .eq("bot_id", bot.id)
      .order("shares", { ascending: false })
      .limit(50)
      .then(({ data }) =>
        data &&
        setHolders(
          data.map((h) => ({
            handle: (h.bm_users as unknown as { handle: string } | null)?.handle ?? "?",
            shares: +h.shares,
            dividends: +h.dividends,
          })),
        ),
      );
  }, [bot.id, bot.supply, bot.dividends_paid]);

  const marks = useMemo<Mark[]>(() => {
    const out: Mark[] = [];
    for (const t of trades) {
      out.push({ time: Date.parse(t.opened_at), kind: "entry", side: t.side });
      out.push({ time: Date.parse(t.closed_at), kind: "exit", side: t.side, win: t.pnl_usd > 0, text: pct(t.pnl_pct, 1) });
    }
    if (bot.position) out.push({ time: bot.position.opened_at, kind: "entry", side: bot.position.side });
    return out;
  }, [trades, bot.position]);

  const lines = useMemo<Line[]>(
    () =>
      bot.position
        ? [
            { price: bot.position.entry, color: "rgba(255,255,255,0.55)", title: "ENTRY" },
            { price: bot.position.tp, color: "#00e38c", title: "TARGET" },
            { price: bot.position.sl, color: "#ff3d57", title: "STOP" },
          ]
        : [],
    [bot.position],
  );

  return (
    <main className="page botpage">
      <div className="bp-head">
        <Link href="/" className="back">
          ← Markets
        </Link>
        <div className="bp-id">
          <BotAvatar bot={bot} size={40} />
          <div>
            <h1>
              {bot.name} <span className="mono muted">${bot.ticker}</span>
            </h1>
            <span className="botmeta">
              by @{bot.creator ?? "—"} · listed {ago(bot.created_at)} ago · <span className="tag">{bot.asset}</span> {strategyLabel(bot)}
            </span>
          </div>
        </div>
        <div className="bp-quote">
          <div>
            <span className="lbl">Share price</span>
            <Flash value={live.price} className="mono big">
              {sharePrice(live.price)}
            </Flash>
            <span className="lbl-unit">pts</span>
          </div>
          <Stat label="24h" tone={tone(live.chg24)}>
            {pct(live.chg24, 1)}
          </Stat>
          <Stat label="Mcap">{compact(live.mcap)}</Stat>
          <Stat label="Holders">{bot.holders}</Stat>
        </div>
      </div>

      <div className="bp-grid">
        <section className="bp-main">
          <div className="panel chart-panel">
            <div className="panel-head">
              <span className="lbl">
                {bot.asset}/USDT · {bot.tf} · <span className="mono">{assetPrice(prices[bot.asset]?.price)}</span>
              </span>
              <PositionCell bot={bot} open={live.open} />
            </div>
            <AssetChart asset={bot.asset} tf={bot.tf} marks={marks} lines={lines} className="chart-lg" />
          </div>
        </section>

        <section className="bp-tabs">
          <div className="panel">
            <div className="tabs-row">
              {(["trades", "strategy", "holders", "shares"] as Tab[]).map((t) => (
                <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
                  {t === "trades" ? `Bot trades · ${bot.trades}` : t === "strategy" ? "Strategy" : t === "holders" ? `Holders · ${bot.holders}` : "Share trades"}
                </button>
              ))}
            </div>
            {tab === "trades" && <TradesTable trades={trades} />}
            {tab === "strategy" && <StrategyTab bot={bot} />}
            {tab === "holders" && <HoldersTable holders={holders} supply={bot.supply} />}
            {tab === "shares" && <SharesTable rows={shares} />}
          </div>
        </section>

        <aside className="bp-side">
          <TradeBox bot={bot} />
          <PositionCard bot={bot} />
          <div className="panel">
            <div className="panel-head">
              <span className="lbl">Performance</span>
            </div>
            <div className="statgrid">
              <Stat label="Equity">{usd(live.equity)}</Stat>
              <Stat label="Return" tone={tone(live.ret)}>
                {pct(live.ret)}
              </Stat>
              <Stat label="Win rate">{live.winRate == null ? "—" : `${live.winRate.toFixed(0)}%`}</Stat>
              <Stat label="Trades">{bot.trades}</Stat>
              <Stat label="Best trade" tone={tone(bot.best_trade)}>
                {bot.trades ? pct(bot.best_trade, 1) : "—"}
              </Stat>
              <Stat label="Dividends paid" tone="gold">
                {pts(bot.dividends_paid)}
              </Stat>
            </div>
          </div>
          <SharePricePanel rows={shares} price={live.price} />
        </aside>
      </div>
    </main>
  );
}

function TradeBox({ bot }: { bot: Bot }) {
  const { me, session, holdings, requireAuth, refreshMe, patchBot } = useApp();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("500");
  const [busy, setBusy] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const holding = holdings[bot.id];
  const balance = me?.balance ?? 0;
  const value = Math.max(0, parseFloat(amount.replace(",", ".")) || 0);

  const priceNow = priceAt(bot.supply);
  const buyShares = side === "buy" && value > 0 ? sharesForPts(value, bot.supply) : 0;
  const priceAfter = priceAt(bot.supply + buyShares);
  // the input shows 2 decimals: treat "almost everything" as "everything" so no dust is left
  const sellN = side === "sell" && holding ? (value >= holding.shares - 0.01 ? holding.shares : value) : 0;
  const receive = sellN > 0 ? ptsForShares(sellN, bot.supply) : 0;
  const costPart = holding && sellN > 0 ? holding.cost * (sellN / holding.shares) : 0;
  const holdValue = holding ? ptsForShares(holding.shares, bot.supply) : 0;
  const holdPnl = holding ? holdValue - holding.cost : 0;

  let label = side === "buy" ? `Buy $${bot.ticker}` : `Sell $${bot.ticker}`;
  let disabled = busy;
  if (!session) label = "Sign up to trade · 10K free pts";
  else if (side === "buy" && bot.status === "rekt") {
    label = "Bot is rekt";
    disabled = true;
  } else if (side === "buy" && value > balance + 1e-6) {
    label = "Not enough pts";
    disabled = true;
  } else if (side === "sell" && !holding) {
    label = `You have no $${bot.ticker}`;
    disabled = true;
  } else if (!(value > 0)) disabled = true;

  async function submit() {
    if (!requireAuth() || !session) return;
    setBusy(true);
    try {
      const r = await rpc<{ shares: number; pts: number; bot?: Record<string, unknown> }>("bm_trade", {
        p_secret: session.secret,
        p_bot: bot.id,
        p_side: side,
        p_amount: side === "buy" ? value : sellN,
      });
      if (r.bot) patchBot(r.bot);
      const { x, y } = centerOf(btn.current);
      if (side === "buy") {
        sfx.buy();
        floatText(`+${pts(Number(r.shares))} $${bot.ticker}`, x, y - 30, "up");
        toast(`Bought ${pts(Number(r.shares))} $${bot.ticker} for ${pts(Number(r.pts))} pts`, "up");
      } else {
        const pnl = Number(r.pts) - costPart;
        if (pnl >= 0) {
          sfx.win();
          confetti(x, y);
          edgeGlow("up");
        } else {
          sfx.lose();
          edgeGlow("down");
        }
        floatText(`${signed(pnl)} pts`, x, y - 30, pnl >= 0 ? "up" : "down");
        toast(`Sold ${pts(sellN)} $${bot.ticker} for ${pts(Number(r.pts))} pts (${signed(pnl)})`, pnl >= 0 ? "up" : "down");
        setAmount("");
      }
      await refreshMe();
    } catch (e) {
      sfx.error();
      toast(e instanceof Error ? e.message : "Trade failed", "down");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel tradebox">
      <div className="seg seg-full">
        <button
          className={side === "buy" ? "on buy" : ""}
          onClick={() => {
            setSide("buy");
            setAmount("500");
          }}
        >
          Buy
        </button>
        <button
          className={side === "sell" ? "on sell" : ""}
          onClick={() => {
            setSide("sell");
            setAmount(holding ? String(Math.floor(holding.shares * 100) / 100) : "");
          }}
        >
          Sell
        </button>
      </div>
      <label className="field">
        <span className="lbl">{side === "buy" ? "Amount (pts)" : "Shares"}</span>
        <div className="amount">
          <input className="input mono" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <span className="unit">{side === "buy" ? "pts" : `$${bot.ticker}`}</span>
        </div>
      </label>
      <div className="presets">
        {side === "buy"
          ? [100, 500, 1000, 5000].map((v) => (
              <button key={v} onClick={() => setAmount(String(v))}>
                {compact(v, 0)}
              </button>
            ))
          : [25, 50, 100].map((p) => (
              <button key={p} disabled={!holding} onClick={() => holding && setAmount(String(Math.floor(((holding.shares * p) / 100) * 100) / 100))}>
                {p}%
              </button>
            ))}
        {side === "buy" && (
          <button disabled={!me} onClick={() => me && setAmount(String(Math.floor(me.balance)))}>
            Max
          </button>
        )}
      </div>
      <div className="quote mono">
        {side === "buy" ? (
          <>
            <span>You get</span>
            <b>
              {pts(buyShares)} ${bot.ticker}
            </b>
            <span>Price after</span>
            <b>
              {sharePrice(priceAfter)} <em className="t-up">{pct((priceAfter / priceNow - 1) * 100, 1)}</em>
            </b>
          </>
        ) : (
          <>
            <span>You receive</span>
            <b>{pts(receive)} pts</b>
            <span>P&amp;L</span>
            <b className={`t-${tone(receive - costPart)}`}>{signed(receive - costPart)}</b>
          </>
        )}
        <span>Fee</span>
        <b className="muted">2% · half to creator</b>
      </div>
      <button ref={btn} className={`btn btn-lg btn-block ${side === "buy" ? "btn-primary" : "btn-sell"}`} disabled={disabled} onClick={session ? submit : () => requireAuth()}>
        {busy ? "…" : label}
      </button>
      {holding && (
        <div className="holding mono">
          <div>
            <span>You own</span>
            <b>{pts(holding.shares)}</b>
          </div>
          <div>
            <span>Value</span>
            <b>{pts(holdValue)}</b>
          </div>
          <div>
            <span>P&amp;L</span>
            <b className={`t-${tone(holdPnl)}`}>{signed(holdPnl)}</b>
          </div>
          <div>
            <span>Dividends</span>
            <b className="t-gold">{pts(holding.dividends)}</b>
          </div>
        </div>
      )}
      {session && me && <div className="muted small">Balance {pts(me.balance)} pts</div>}
    </div>
  );
}

function PositionCard({ bot }: { bot: Bot }) {
  const prices = usePrices();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const pos = bot.position;
  const mark = prices[bot.asset]?.price;
  if (bot.status === "rekt") {
    return (
      <div className="panel poscard rekt">
        <span className="lbl">Position</span>
        <b className="t-down">☠ Rekt</b>
        <p className="muted small">Equity fell below 1% of capital. The bot stopped trading.</p>
      </div>
    );
  }
  if (!pos) {
    return (
      <div className="panel poscard">
        <div className="panel-head">
          <span className="lbl">Position</span>
          <span className="pill pill-flat">FLAT</span>
        </div>
        <p className="muted small">Scanning {bot.asset} on the {bot.tf} chart for the next signal…</p>
        <div className="scan">
          <i />
        </div>
      </div>
    );
  }
  const open = openPnl(bot, mark);
  const lo = Math.min(pos.sl, pos.tp);
  const hi = Math.max(pos.sl, pos.tp);
  const at = mark ? Math.min(1, Math.max(0, (mark - lo) / (hi - lo))) : 0.5;
  const entryAt = (pos.entry - lo) / (hi - lo);
  const left = pos.side === "long" ? "STOP" : "TARGET";
  const right = pos.side === "long" ? "TARGET" : "STOP";
  const timeLeft = pos.opened_at + bot.max_bars * TF_MS[bot.tf] - now;
  return (
    <div className={`panel poscard is-open ${open && open.pct >= 0 ? "winning" : "losing"}`}>
      <div className="panel-head">
        <span className="lbl">
          <i className="live" /> Open position
        </span>
        <span className={`pill pill-${pos.side}`}>
          {pos.side.toUpperCase()} {pos.lev}x {bot.asset}
        </span>
      </div>
      <Flash value={open?.pct ?? 0} className={`poscard-pnl mono t-${tone(open?.pct)}`}>
        {pct(open?.pct)}
      </Flash>
      <div className={`mono small t-${tone(open?.usd)}`}>{open ? `${signed(open.usd, (n) => usd(n, 2))} on ${usd(pos.equity)}` : "—"}</div>
      <div className={`range range-${pos.side}`}>
        <div className="range-bar">
          <i className="range-entry" style={{ left: `${entryAt * 100}%` }} />
          <i className="range-mark" style={{ left: `${at * 100}%` }} />
        </div>
        <div className="range-lbl mono">
          <span className={left === "STOP" ? "t-down" : "t-up"}>
            {left} {assetPrice(lo)}
          </span>
          <span className={right === "STOP" ? "t-down" : "t-up"}>
            {right} {assetPrice(hi)}
          </span>
        </div>
      </div>
      <div className="kv mono">
        <span>Entry</span>
        <b>{assetPrice(pos.entry)}</b>
        <span>Mark</span>
        <b>{assetPrice(mark)}</b>
        <span>Open for</span>
        <b>{duration(now - pos.opened_at)}</b>
        <span>Time stop</span>
        <b>{timeLeft > 0 ? duration(timeLeft) : "now"}</b>
      </div>
    </div>
  );
}

function StrategyTab({ bot }: { bot: Bot }) {
  const cfg: BotConfig = { strategy: bot.strategy, params: bot.params, side: bot.side, leverage: bot.leverage, tp: bot.tp, sl: bot.sl, max_bars: bot.max_bars, tf: bot.tf };
  const [bt, setBt] = useState<ReturnType<typeof backtest> | null>(null);
  useEffect(() => {
    let dead = false;
    fetchKlines(bot.asset, bot.tf, 1000)
      .then((cs) => !dead && setBt(backtest(cfg, cs)))
      .catch(() => undefined);
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot.id]);
  const spec = STRATEGIES[bot.strategy];
  return (
    <div className="strategy">
      <p className="describe">{describe(cfg, bot.asset)}</p>
      <div className="paramrow">
        <span className="tag">{spec.name}</span>
        {spec.params.map((p) => (
          <span key={p.key} className="tag tag-dim">
            {p.label} <b className="mono">{bot.params[p.key]}</b>
          </span>
        ))}
        <span className="tag tag-dim">
          Max hold <b className="mono">{bot.max_bars} candles</b>
        </span>
      </div>
      <div className="panel-sub">
        <span className="lbl">Backtest · last 1,000 {bot.tf} candles</span>
        {bt ? (
          <div className="statgrid statgrid-4">
            <Stat label="Return" tone={tone(bt.returnPct)}>
              {pct(bt.returnPct)}
            </Stat>
            <Stat label="Win rate">{bt.trades.length ? `${bt.winRate.toFixed(0)}%` : "—"}</Stat>
            <Stat label="Trades">{bt.trades.length}</Stat>
            <Stat label="Max drawdown" tone="down">
              {pct(-bt.maxDD, 1)}
            </Stat>
          </div>
        ) : (
          <i className="spinner" />
        )}
      </div>
    </div>
  );
}

function TradesTable({ trades }: { trades: BotTrade[] }) {
  if (!trades.length) return <div className="empty">No closed trades yet. The bot is waiting for its first signal.</div>;
  return (
    <div className="tbl-wrap">
      <table className="tbl tbl-sm">
        <thead>
          <tr>
            <th>Closed</th>
            <th>Side</th>
            <th className="num">Entry</th>
            <th className="num">Exit</th>
            <th className="num">PnL</th>
            <th className="num c-hide">USD</th>
            <th>Reason</th>
            <th className="num">Dividend</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.id}>
              <td className="mono muted">{ago(t.closed_at)} ago</td>
              <td>
                <span className={`pill pill-${t.side}`}>
                  {t.side.toUpperCase()} {t.leverage}x
                </span>
              </td>
              <td className="num mono">{assetPrice(t.entry)}</td>
              <td className="num mono">{assetPrice(t.exit)}</td>
              <td className={`num mono t-${tone(t.pnl_pct)}`}>{pct(t.pnl_pct)}</td>
              <td className={`num mono c-hide t-${tone(t.pnl_usd)}`}>{signed(t.pnl_usd, (n) => usd(n, 0))}</td>
              <td className="muted">{t.reason}</td>
              <td className="num mono t-gold">{t.dividend > 0 ? `+${pts(t.dividend)}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HoldersTable({ holders, supply }: { holders: { handle: string; shares: number; dividends: number }[]; supply: number }) {
  if (!holders.length) return <div className="empty">No holders yet. Be the first — the curve starts at 1 pt per share.</div>;
  return (
    <div className="tbl-wrap">
      <table className="tbl tbl-sm">
        <thead>
          <tr>
            <th>#</th>
            <th>Holder</th>
            <th className="num">Shares</th>
            <th className="num">Of supply</th>
            <th className="num">Dividends</th>
          </tr>
        </thead>
        <tbody>
          {holders.map((h, i) => (
            <tr key={h.handle}>
              <td className="mono muted">{i + 1}</td>
              <td>@{h.handle}</td>
              <td className="num mono">{pts(h.shares)}</td>
              <td className="num mono">{supply > 0 ? `${((h.shares / supply) * 100).toFixed(1)}%` : "—"}</td>
              <td className="num mono t-gold">{pts(h.dividends)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SharesTable({ rows }: { rows: ShareTrade[] }) {
  if (!rows.length) return <div className="empty">No share trades yet.</div>;
  return (
    <div className="tbl-wrap">
      <table className="tbl tbl-sm">
        <thead>
          <tr>
            <th>Time</th>
            <th>Trader</th>
            <th>Side</th>
            <th className="num">Shares</th>
            <th className="num">Pts</th>
            <th className="num">Price after</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((t) => (
            <tr key={t.id}>
              <td className="mono muted">{ago(t.created_at)} ago</td>
              <td>@{t.handle}</td>
              <td className={t.side === "buy" ? "t-up" : "t-down"}>{t.side}</td>
              <td className="num mono">{pts(t.shares)}</td>
              <td className="num mono">{pts(t.pts)}</td>
              <td className="num mono">{sharePrice(t.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SharePricePanel({ rows, price }: { rows: ShareTrade[]; price: number }) {
  const pointsList = useMemo(() => [1, ...[...rows].reverse().map((r) => r.price), price], [rows, price]);
  const w = 300;
  const h = 70;
  const min = Math.min(...pointsList);
  const max = Math.max(...pointsList);
  const span = max - min || 1;
  const step = w / Math.max(1, pointsList.length - 1);
  const pts2 = pointsList.map((p, i) => [i * step, h - 4 - ((p - min) / span) * (h - 8)] as const);
  const d = pts2.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="lbl">Share price since IPO</span>
        <span className={`mono small t-${tone(price - 1)}`}>{pct((price - 1) * 100, 0)}</span>
      </div>
      <svg className="sharechart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="spg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#00e38c" stopOpacity="0.28" />
            <stop offset="1" stopColor="#00e38c" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${h} ${d} ${w},${h}`} fill="url(#spg)" />
        <polyline points={d} fill="none" stroke="#00e38c" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="muted small">{rows.length ? `${rows.length} trades` : "IPO price: 1.0000 pts"}</div>
    </div>
  );
}
