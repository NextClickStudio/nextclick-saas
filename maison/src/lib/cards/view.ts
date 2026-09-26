/**
 * What the UI needs to draw a card: a trend, and optionally the copy you own.
 */
import { GAME_CONFIG, Rarity, cardWorth, sellPrice } from "@/config/game";
import type { Family } from "./families";
import type { MaterialSpec } from "./materials";

export interface TrendStyle {
  hex?: string;
  material?: MaterialSpec & { main: string; accent: string };
  mood?: [string, string];
}

export interface CardView {
  /** Card id when you own it. */
  id?: string;
  trendId: string;
  name: string;
  family: Family;
  style: TrendStyle;
  rarity: Rarity;
  serial: number;
  /** Current price. */
  value: number;
  /** Price at the start of today (UTC). */
  dayOpen: number;
  /** Price when you got the card (owned cards only). */
  boughtAt?: number;
  /** Chart points, oldest first. */
  history: number[];
}

export interface CardNumbers {
  change: number;
  month: number;
  pnl: number;
  worth: number;
  sell: number;
  pnlCredits: number;
  ath: boolean;
  hype: "hot" | "cooling" | null;
  multiplier: number;
}

export function cardNumbers(c: CardView): CardNumbers {
  const multiplier = GAME_CONFIG.rarityMultiplier[c.rarity];
  const worth = cardWorth(c.value, c.rarity);
  const change = c.dayOpen ? c.value / c.dayOpen - 1 : 0;
  const first = c.history[0] ?? c.value;
  const t = GAME_CONFIG.market.hypeThreshold;
  const bought = c.boughtAt ?? c.value;
  return {
    change,
    month: first ? c.value / first - 1 : 0,
    pnl: bought ? c.value / bought - 1 : 0,
    worth,
    sell: sellPrice(c.value, c.rarity),
    pnlCredits: worth - cardWorth(bought, c.rarity),
    ath: c.history.length > 3 && c.value >= Math.max(...c.history),
    hype: change >= t ? "hot" : change <= -t ? "cooling" : null,
    multiplier,
  };
}
