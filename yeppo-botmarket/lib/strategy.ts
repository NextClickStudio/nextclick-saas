// Strategy engine shared by the web app (backtests) and the bm-engine edge function (live trading).
// Dependency-free on purpose: the same file is copied into supabase/functions/bm-engine.

export type Timeframe = "1m" | "5m" | "15m" | "1h";
export type StrategyId = "rsi" | "ema" | "breakout" | "dip" | "momentum";
export type Side = "long" | "short";

export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number; T: number };

export type BotConfig = {
  strategy: StrategyId;
  params: Record<string, number>;
  side: Side;
  leverage: number;
  tp: number;
  sl: number;
  max_bars: number;
  tf: Timeframe;
};

export type Position = { side: Side; entry: number; lev: number; opened_at: number; tp: number; sl: number; equity: number };

export const ASSETS = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  BNB: "BNBUSDT",
  XRP: "XRPUSDT",
  DOGE: "DOGEUSDT",
  PEPE: "PEPEUSDT",
  WIF: "WIFUSDT",
  SUI: "SUIUSDT",
  AVAX: "AVAXUSDT",
} as const;
export type Asset = keyof typeof ASSETS;

export const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h"];
export const TF_MS: Record<Timeframe, number> = { "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3_600_000 };
export const CAPITAL = 10_000;
export const FEE_RATE = 0.0005;
/** pts paid to shareholders for every $1 of bot profit */
export const DIV_RATE = 3;

type ParamSpec = { key: string; label: string; min: number; max: number; step: number; def: number };

export const STRATEGIES: Record<StrategyId, { name: string; blurb: string; params: ParamSpec[] }> = {
  rsi: {
    name: "RSI Reversal",
    blurb: "Buys oversold, sells overbought.",
    params: [
      { key: "period", label: "RSI period", min: 5, max: 30, step: 1, def: 14 },
      { key: "low", label: "Oversold below", min: 10, max: 45, step: 1, def: 30 },
      { key: "high", label: "Overbought above", min: 55, max: 90, step: 1, def: 70 },
    ],
  },
  ema: {
    name: "EMA Cross",
    blurb: "Rides the trend when the fast EMA crosses the slow one.",
    params: [
      { key: "fast", label: "Fast EMA", min: 3, max: 50, step: 1, def: 9 },
      { key: "slow", label: "Slow EMA", min: 5, max: 200, step: 1, def: 21 },
    ],
  },
  breakout: {
    name: "Breakout",
    blurb: "Enters when price breaks the recent range.",
    params: [{ key: "lookback", label: "Range (candles)", min: 5, max: 100, step: 1, def: 20 }],
  },
  dip: {
    name: "Dip Hunter",
    blurb: "Catches sharp drops (or fades pumps when short).",
    params: [
      { key: "drop", label: "Move size %", min: 0.5, max: 20, step: 0.1, def: 3 },
      { key: "bars", label: "Within candles", min: 2, max: 48, step: 1, def: 6 },
    ],
  },
  momentum: {
    name: "Momentum",
    blurb: "Jumps on big candles with a volume spike.",
    params: [
      { key: "move", label: "Candle move %", min: 0.2, max: 10, step: 0.1, def: 1 },
      { key: "vol", label: "Volume × average", min: 1, max: 10, step: 0.1, def: 2 },
    ],
  },
};

export const defaultParams = (s: StrategyId) => Object.fromEntries(STRATEGIES[s].params.map((p) => [p.key, p.def]));

export function parseKlines(raw: unknown[][]): Candle[] {
  return raw.map((k) => ({
    t: Number(k[0]),
    o: Number(k[1]),
    h: Number(k[2]),
    l: Number(k[3]),
    c: Number(k[4]),
    v: Number(k[5]),
    T: Number(k[6]),
  }));
}

function rsiSeries(close: number[], period: number) {
  const out = new Array<number>(close.length).fill(NaN);
  if (close.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = close[i] - close[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < close.length; i++) {
    const d = close[i] - close[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

function emaSeries(values: number[], period: number) {
  const out = new Array<number>(values.length).fill(NaN);
  if (!values.length) return out;
  const k = 2 / (period + 1);
  out[0] = values[0];
  for (let i = 1; i < values.length; i++) out[i] = values[i] * k + out[i - 1] * (1 - k);
  return out;
}

export type Prepared = { rsi?: number[]; fast?: number[]; slow?: number[] };

export function prepare(cfg: BotConfig, candles: Candle[]): Prepared {
  const close = candles.map((c) => c.c);
  if (cfg.strategy === "rsi") return { rsi: rsiSeries(close, cfg.params.period ?? 14) };
  if (cfg.strategy === "ema") return { fast: emaSeries(close, cfg.params.fast ?? 9), slow: emaSeries(close, cfg.params.slow ?? 21) };
  return {};
}

export function warmup(cfg: BotConfig) {
  const p = cfg.params;
  switch (cfg.strategy) {
    case "rsi":
      return (p.period ?? 14) + 2;
    case "ema":
      return (p.slow ?? 21) + 2;
    case "breakout":
      return (p.lookback ?? 20) + 1;
    case "dip":
      return (p.bars ?? 6) + 1;
    case "momentum":
      return 21;
  }
}

const maxHigh = (c: Candle[], from: number, to: number) => {
  let m = -Infinity;
  for (let j = Math.max(0, from); j <= to; j++) m = Math.max(m, c[j].h);
  return m;
};
const minLow = (c: Candle[], from: number, to: number) => {
  let m = Infinity;
  for (let j = Math.max(0, from); j <= to; j++) m = Math.min(m, c[j].l);
  return m;
};

/** Entry / exit signal on the close of candle i (long logic, mirrored for shorts). */
export function signal(cfg: BotConfig, c: Candle[], ind: Prepared, i: number): { enter: boolean; exit: boolean } {
  const none = { enter: false, exit: false };
  if (i < warmup(cfg) || i >= c.length) return none;
  const long = cfg.side === "long";
  const p = cfg.params;
  switch (cfg.strategy) {
    case "rsi": {
      const r = ind.rsi?.[i];
      if (r == null || isNaN(r)) return none;
      const low = p.low ?? 30;
      const high = p.high ?? 70;
      return long ? { enter: r < low, exit: r > high } : { enter: r > high, exit: r < low };
    }
    case "ema": {
      const f = ind.fast!;
      const s = ind.slow!;
      const up = f[i - 1] <= s[i - 1] && f[i] > s[i];
      const down = f[i - 1] >= s[i - 1] && f[i] < s[i];
      return long ? { enter: up, exit: down } : { enter: down, exit: up };
    }
    case "breakout": {
      const lb = p.lookback ?? 20;
      const half = Math.max(2, Math.ceil(lb / 2));
      if (long) return { enter: c[i].c > maxHigh(c, i - lb, i - 1), exit: c[i].c < minLow(c, i - half, i - 1) };
      return { enter: c[i].c < minLow(c, i - lb, i - 1), exit: c[i].c > maxHigh(c, i - half, i - 1) };
    }
    case "dip": {
      const bars = p.bars ?? 6;
      const drop = (p.drop ?? 3) / 100;
      if (long) return { enter: c[i].c <= maxHigh(c, i - bars, i) * (1 - drop), exit: false };
      return { enter: c[i].c >= minLow(c, i - bars, i) * (1 + drop), exit: false };
    }
    case "momentum": {
      let avg = 0;
      for (let j = i - 20; j < i; j++) avg += c[j].v;
      avg /= 20;
      const move = ((c[i].c - c[i].o) / c[i].o) * 100;
      const spike = avg > 0 && c[i].v >= (p.vol ?? 2) * avg;
      const need = p.move ?? 1;
      return { enter: spike && (long ? move >= need : move <= -need), exit: false };
    }
  }
}

export function levels(side: Side, entry: number, tp: number, sl: number) {
  return side === "long"
    ? { tp: entry * (1 + tp / 100), sl: entry * (1 - sl / 100) }
    : { tp: entry * (1 - tp / 100), sl: entry * (1 + sl / 100) };
}

/** Leveraged PnL in USD, fees on both sides, never worse than losing the whole stake. */
export function pnlUsd(side: Side, lev: number, entry: number, exit: number, equity: number) {
  const move = side === "long" ? exit / entry - 1 : (entry - exit) / entry;
  const notional = equity * lev;
  return Math.max(-equity, notional * move - notional * FEE_RATE * 2);
}

/** Did this candle hit the stop or the target? Stop is checked first (conservative). */
export function checkExit(pos: Pick<Position, "side" | "tp" | "sl">, k: Candle): { price: number; reason: "stop" | "target" } | null {
  if (pos.side === "long") {
    if (k.l <= pos.sl) return { price: Math.min(pos.sl, k.o), reason: "stop" };
    if (k.h >= pos.tp) return { price: Math.max(pos.tp, k.o), reason: "target" };
  } else {
    if (k.h >= pos.sl) return { price: Math.max(pos.sl, k.o), reason: "stop" };
    if (k.l <= pos.tp) return { price: Math.min(pos.tp, k.o), reason: "target" };
  }
  return null;
}

export type SimTrade = {
  side: Side;
  entry: number;
  exit: number;
  entryT: number;
  exitT: number;
  pnl: number;
  pct: number;
  reason: string;
};

export function backtest(cfg: BotConfig, candles: Candle[], capital = CAPITAL) {
  const ind = prepare(cfg, candles);
  const trades: SimTrade[] = [];
  const curve: { t: number; eq: number }[] = [];
  let equity = capital;
  let peak = capital;
  let maxDD = 0;
  let pos: (Position & { i: number }) | null = null;
  let lastExit = -1;

  const close = (price: number, reason: string, t: number) => {
    if (!pos) return;
    const pnl = pnlUsd(pos.side, pos.lev, pos.entry, price, pos.equity);
    trades.push({ side: pos.side, entry: pos.entry, exit: price, entryT: pos.opened_at, exitT: t, pnl, pct: (pnl / pos.equity) * 100, reason });
    equity = Math.max(0, equity + pnl);
    pos = null;
  };

  for (let i = warmup(cfg); i < candles.length; i++) {
    const k = candles[i];
    if (pos && i > pos.i) {
      const hit = checkExit(pos, k);
      if (hit) {
        close(hit.price, hit.reason, k.T);
        lastExit = i;
      } else {
        const s = signal(cfg, candles, ind, i);
        if (s.exit) {
          close(k.c, "signal", k.T);
          lastExit = i;
        } else if (i - pos.i >= cfg.max_bars) {
          close(k.c, "time", k.T);
          lastExit = i;
        }
      }
    }
    if (!pos && i > lastExit && equity > capital * 0.01 && signal(cfg, candles, ind, i).enter) {
      const lv = levels(cfg.side, k.c, cfg.tp, cfg.sl);
      pos = { side: cfg.side, entry: k.c, lev: cfg.leverage, opened_at: k.T, tp: lv.tp, sl: lv.sl, equity, i };
    }
    const open = pos ? pnlUsd(pos.side, pos.lev, pos.entry, k.c, pos.equity) : 0;
    const eq = equity + open;
    peak = Math.max(peak, eq);
    maxDD = Math.max(maxDD, peak > 0 ? (peak - eq) / peak : 0);
    curve.push({ t: k.T, eq });
  }

  const wins = trades.filter((t) => t.pnl > 0).length;
  const last = curve.length ? curve[curve.length - 1].eq : capital;
  return {
    trades,
    curve,
    open: pos as (Position & { i: number }) | null,
    winRate: trades.length ? (wins / trades.length) * 100 : 0,
    returnPct: (last / capital - 1) * 100,
    maxDD: maxDD * 100,
  };
}

const fmtN = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Plain-English description of what a bot does. */
export function describe(cfg: BotConfig, asset: string) {
  const p = cfg.params;
  const long = cfg.side === "long";
  const verb = long ? "Goes long" : "Goes short";
  let when: string;
  switch (cfg.strategy) {
    case "rsi":
      when = long
        ? `when RSI(${p.period}) drops below ${fmtN(p.low)}, exits above ${fmtN(p.high)}`
        : `when RSI(${p.period}) climbs above ${fmtN(p.high)}, exits below ${fmtN(p.low)}`;
      break;
    case "ema":
      when = `when EMA ${p.fast} crosses ${long ? "above" : "below"} EMA ${p.slow}, exits on the opposite cross`;
      break;
    case "breakout":
      when = `when price breaks the ${long ? "high" : "low"} of the last ${p.lookback} candles`;
      break;
    case "dip":
      when = long ? `after a ${fmtN(p.drop)}% drop within ${p.bars} candles` : `after a ${fmtN(p.drop)}% pump within ${p.bars} candles`;
      break;
    case "momentum":
      when = `on a ${fmtN(p.move)}% ${long ? "green" : "red"} candle with ${fmtN(p.vol)}× average volume`;
      break;
  }
  return `${verb} ${asset} ${when} on the ${cfg.tf} chart. Target +${fmtN(cfg.tp)}%, stop −${fmtN(cfg.sl)}%, ${cfg.leverage}x leverage.`;
}
