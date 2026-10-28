"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ASSET_LIST, fetchKlines } from "@/lib/market";
import { rpc } from "@/lib/supabase";
import { backtest, defaultParams, describe, STRATEGIES, TIMEFRAMES, type Asset, type BotConfig, type Candle, type Side, type StrategyId, type Timeframe } from "@/lib/strategy";
import { LAUNCH_FEE } from "@/lib/config";
import { pct, pts, tone } from "@/lib/format";
import { confetti, sfx, toast } from "@/lib/fx";
import { useApp } from "./AppProvider";
import AssetChart, { type Mark } from "./AssetChart";
import { Spark, Stat } from "./ui";

const EMOJIS = ["🤖", "🎯", "🚀", "🐸", "🦈", "🐻", "🐂", "⚡", "🧊", "🔥", "💎", "👾", "🦅", "🌀", "🧠", "🩸"];

function Slider({ label, value, min, max, step, onChange, unit = "" }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <label className="slider">
      <span className="slider-top">
        <span className="lbl">{label}</span>
        <b className="mono">
          {value}
          {unit}
        </b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ ["--p" as string]: `${((value - min) / (max - min)) * 100}%` }} />
    </label>
  );
}

export default function Launch() {
  const router = useRouter();
  const { session, me, requireAuth, refreshBots, refreshMe } = useApp();
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [tickerTouched, setTickerTouched] = useState(false);
  const [emoji, setEmoji] = useState("🤖");
  const [asset, setAsset] = useState<Asset>("BTC");
  const [tf, setTf] = useState<Timeframe>("5m");
  const [strategy, setStrategy] = useState<StrategyId>("rsi");
  const [params, setParams] = useState<Record<string, number>>(defaultParams("rsi"));
  const [side, setSide] = useState<Side>("long");
  const [leverage, setLeverage] = useState(3);
  const [tp, setTp] = useState(2);
  const [sl, setSl] = useState(1);
  const [maxBars, setMaxBars] = useState(48);
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const slMax = Math.min(25, Math.floor((90 / leverage) * 10) / 10);
  useEffect(() => {
    if (sl > slMax) setSl(slMax);
  }, [sl, slMax]);

  useEffect(() => {
    if (!tickerTouched) setTicker(name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5));
  }, [name, tickerTouched]);

  useEffect(() => {
    let dead = false;
    setCandles(null);
    fetchKlines(asset, tf, 1000)
      .then((cs) => !dead && setCandles(cs))
      .catch(() => !dead && setCandles([]));
    return () => {
      dead = true;
    };
  }, [asset, tf]);

  const cfg: BotConfig = useMemo(
    () => ({ strategy, params, side, leverage, tp, sl, max_bars: maxBars, tf }),
    [strategy, params, side, leverage, tp, sl, maxBars, tf],
  );
  const bt = useMemo(() => (candles && candles.length ? backtest(cfg, candles) : null), [cfg, candles]);
  const marks = useMemo<Mark[]>(
    () =>
      bt
        ? bt.trades.flatMap((t) => [
            { time: t.entryT, kind: "entry" as const, side: t.side },
            { time: t.exitT, kind: "exit" as const, side: t.side, win: t.pnl > 0, text: pct(t.pct, 1) },
          ])
        : [],
    [bt],
  );

  const pickStrategy = (s: StrategyId) => {
    setStrategy(s);
    setParams(defaultParams(s));
  };

  const valid = name.trim().length >= 3 && /^[A-Z0-9]{2,6}$/.test(ticker) && (strategy !== "ema" || params.fast < params.slow);

  async function launch() {
    if (!requireAuth() || !session) return;
    setBusy(true);
    setErr(null);
    try {
      const bot = await rpc<{ ticker: string }>("bm_launch", {
        p_secret: session.secret,
        p_cfg: { name: name.trim(), ticker, emoji, asset, tf, strategy, params, side, leverage, tp, sl, max_bars: maxBars },
      });
      sfx.win();
      confetti();
      toast(`$${bot.ticker} is live. Buy the first shares at 1 pt.`, "gold");
      await Promise.all([refreshBots(), refreshMe()]);
      router.push(`/bot/${bot.ticker}`);
    } catch (e) {
      sfx.error();
      setErr(e instanceof Error ? e.message : "Launch failed");
      setBusy(false);
    }
  }

  const spec = STRATEGIES[strategy];

  return (
    <main className="page launch">
      <section className="ln-form">
        <div className="ln-head">
          <h1>Launch a bot</h1>
          <p className="muted">Design a strategy, check the backtest, list it. It starts trading the live market within a minute.</p>
        </div>

        <div className="panel">
          <div className="grid2">
            <label className="field">
              <span className="lbl">Name</span>
              <input className="input" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="RSI Sniper" />
            </label>
            <label className="field">
              <span className="lbl">Ticker</span>
              <input
                className="input mono"
                value={ticker}
                maxLength={6}
                onChange={(e) => {
                  setTickerTouched(true);
                  setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                }}
                placeholder="SNIPE"
              />
            </label>
          </div>
          <div className="emojis">
            {EMOJIS.map((e) => (
              <button key={e} className={emoji === e ? "on" : ""} onClick={() => setEmoji(e)} aria-label={`Icon ${e}`}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <span className="lbl">Market</span>
          <div className="chips chips-wrap">
            {ASSET_LIST.map((a) => (
              <button key={a} className={asset === a ? "on" : ""} onClick={() => setAsset(a)}>
                {a}
              </button>
            ))}
          </div>
          <div className="seg">
            {TIMEFRAMES.map((t) => (
              <button key={t} className={tf === t ? "on" : ""} onClick={() => setTf(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <span className="lbl">Strategy</span>
          <div className="strats">
            {(Object.keys(STRATEGIES) as StrategyId[]).map((s) => (
              <button key={s} className={`strat ${strategy === s ? "on" : ""}`} onClick={() => pickStrategy(s)}>
                <b>{STRATEGIES[s].name}</b>
                <span>{STRATEGIES[s].blurb}</span>
              </button>
            ))}
          </div>
          {spec.params.map((p) => (
            <Slider key={`${strategy}-${p.key}`} label={p.label} value={params[p.key]} min={p.min} max={p.max} step={p.step} onChange={(v) => setParams((x) => ({ ...x, [p.key]: v }))} />
          ))}
        </div>

        <div className="panel">
          <span className="lbl">Risk</span>
          <div className="seg seg-full">
            <button className={side === "long" ? "on buy" : ""} onClick={() => setSide("long")}>
              Long
            </button>
            <button className={side === "short" ? "on sell" : ""} onClick={() => setSide("short")}>
              Short
            </button>
          </div>
          <Slider label="Leverage" value={leverage} min={1} max={10} step={1} unit="x" onChange={setLeverage} />
          <Slider label="Take profit (price move)" value={tp} min={0.2} max={20} step={0.1} unit="%" onChange={setTp} />
          <Slider label="Stop loss (price move)" value={Math.min(sl, slMax)} min={0.2} max={slMax} step={0.1} unit="%" onChange={setSl} />
          <Slider label="Max hold (candles)" value={maxBars} min={3} max={200} step={1} onChange={setMaxBars} />
          <p className="muted small">
            At {leverage}x a {tp}% move pays {pct(tp * leverage, 1)} and a {Math.min(sl, slMax)}% move costs {pct(-Math.min(sl, slMax) * leverage, 1)}.
          </p>
        </div>
      </section>

      <section className="ln-preview">
        <div className="panel ln-card">
          <div className="ln-card-id">
            <span className="avatar" style={{ width: 40, height: 40, fontSize: 21 }}>
              {emoji}
            </span>
            <div>
              <b>{name.trim() || "Your bot"}</b>
              <span className="mono muted">${ticker || "TICKER"}</span>
            </div>
            <span className={`pill pill-${side}`}>
              {side.toUpperCase()} {leverage}x
            </span>
          </div>
          <p className="describe">{describe(cfg, asset)}</p>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="lbl">
              Backtest · {asset}/USDT · last 1,000 {tf} candles
            </span>
            {bt && <span className="muted small mono">{bt.trades.length} trades</span>}
          </div>
          <div className="statgrid statgrid-4">
            <Stat label="Return" tone={tone(bt?.returnPct)}>
              {bt ? pct(bt.returnPct) : "—"}
            </Stat>
            <Stat label="Win rate">{bt && bt.trades.length ? `${bt.winRate.toFixed(0)}%` : "—"}</Stat>
            <Stat label="Trades">{bt ? bt.trades.length : "—"}</Stat>
            <Stat label="Max drawdown" tone="down">
              {bt ? pct(-bt.maxDD, 1) : "—"}
            </Stat>
          </div>
          <div className="ln-curve">
            <Spark points={bt ? bt.curve.filter((_, i) => i % 4 === 0).map((c) => c.eq) : []} w={640} h={56} />
          </div>
          {candles ? <AssetChart asset={asset} tf={tf} candles={candles} marks={marks} className="chart-md" /> : <div className="chart chart-md chart-msg"><i className="spinner" /></div>}
          <p className="muted small">Past performance on real candles. The live bot can do better or worse.</p>
        </div>

        <div className="panel ln-go">
          <div>
            <b>
              Listing fee <span className="mono">{pts(LAUNCH_FEE)}</span> pts
            </b>
            <span className="muted small">You earn 1% of every trade in your bot&apos;s shares. Max 5 bots per account.</span>
          </div>
          <button className="btn btn-primary btn-lg" disabled={busy || (!!session && (!valid || (!!me && me.balance < LAUNCH_FEE)))} onClick={launch}>
            {busy ? "Launching…" : !session ? "Sign up to launch" : me && me.balance < LAUNCH_FEE ? "Not enough pts" : `Launch $${ticker || "…"}`}
          </button>
        </div>
        {err && <div className="form-err">{err}</div>}
      </section>
    </main>
  );
}
