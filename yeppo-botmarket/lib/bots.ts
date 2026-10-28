import { CAPITAL, pnlUsd, STRATEGIES } from "./strategy";
import { priceAt } from "./curve";
import type { Ticker } from "./market";
import type { Bot } from "./types";

/** Unrealised PnL of the open position at the live price. */
export function openPnl(bot: Bot, price: number | undefined) {
  const p = bot.position;
  if (!p || !price) return null;
  const usd = pnlUsd(p.side, p.lev, p.entry, price, p.equity);
  return { usd, pct: (usd / p.equity) * 100 };
}

export function botLive(bot: Bot, prices: Partial<Record<string, Ticker>>) {
  const open = openPnl(bot, prices[bot.asset]?.price);
  const equity = bot.equity + (open?.usd ?? 0);
  const price = priceAt(bot.supply);
  const price24 = priceAt(bot.supply_24h ?? 0);
  return {
    open,
    equity,
    ret: (equity / CAPITAL - 1) * 100,
    winRate: bot.trades ? (bot.wins / bot.trades) * 100 : null,
    price,
    chg24: price24 > 0 ? (price / price24 - 1) * 100 : 0,
    mcap: price * bot.supply,
  };
}

export const strategyLabel = (b: Pick<Bot, "strategy" | "tf" | "side" | "leverage">) =>
  `${STRATEGIES[b.strategy]?.name ?? b.strategy} · ${b.tf} · ${b.side === "long" ? "L" : "S"} ${b.leverage}x`;
