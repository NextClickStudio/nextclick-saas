import type { Asset, Position, Side, StrategyId, Timeframe } from "./strategy";

export type Bot = {
  id: string;
  ticker: string;
  name: string;
  emoji: string;
  creator_id: string;
  creator?: string;
  asset: Asset;
  tf: Timeframe;
  strategy: StrategyId;
  params: Record<string, number>;
  side: Side;
  leverage: number;
  tp: number;
  sl: number;
  max_bars: number;
  status: "active" | "rekt";
  capital: number;
  equity: number;
  position: Position | null;
  last_signal: number;
  trades: number;
  wins: number;
  pnl_usd: number;
  best_trade: number;
  dividends_paid: number;
  supply: number;
  holders: number;
  volume: number;
  created_at: string;
  updated_at: string;
  supply_24h?: number;
  volume_24h?: number;
};

export type UserStats = {
  id: string;
  handle: string;
  balance: number;
  is_house: boolean;
  created_at: string;
  holdings_value: number;
  dividends: number;
  net_worth: number;
  bots: number;
  last_claim_at?: string | null;
};

export type Holding = { user_id: string; bot_id: string; shares: number; cost: number; dividends: number; updated_at: string };

export type ActivityKind = "join" | "ipo" | "buy" | "sell" | "open" | "close" | "rekt" | "claim";

export type Activity = {
  id: number;
  kind: ActivityKind;
  bot_id: string | null;
  ticker: string | null;
  emoji: string | null;
  handle: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
  created_at: string;
};

export type BotTrade = {
  id: number;
  bot_id: string;
  side: Side;
  leverage: number;
  entry: number;
  exit: number;
  pnl_usd: number;
  pnl_pct: number;
  equity_after: number;
  reason: string;
  dividend: number;
  opened_at: string;
  closed_at: string;
};

export type ShareTrade = {
  id: number;
  bot_id: string;
  user_id: string;
  handle: string;
  side: "buy" | "sell";
  shares: number;
  pts: number;
  price: number;
  supply_after: number;
  created_at: string;
};

export type Session = { secret: string; userId: string; handle: string };

const NUM_KEYS = [
  "leverage",
  "tp",
  "sl",
  "capital",
  "equity",
  "trades",
  "wins",
  "pnl_usd",
  "best_trade",
  "dividends_paid",
  "supply",
  "holders",
  "volume",
  "last_signal",
  "supply_24h",
  "volume_24h",
] as const;

/** PostgREST/realtime may send numerics as strings: normalise once. */
export function normBot(raw: Record<string, unknown>, prev?: Bot): Bot {
  const b = { ...(prev ?? {}), ...raw } as Record<string, unknown>;
  for (const k of NUM_KEYS) if (b[k] != null) b[k] = Number(b[k]);
  return b as unknown as Bot;
}

export function normUser(raw: Record<string, unknown>): UserStats {
  const u = { ...raw } as Record<string, unknown>;
  for (const k of ["balance", "holdings_value", "dividends", "net_worth", "bots"]) if (u[k] != null) u[k] = Number(u[k]);
  return u as unknown as UserStats;
}
