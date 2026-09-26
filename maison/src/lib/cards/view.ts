/**
 * What the UI needs to draw a card, whatever the data source (database or demo).
 */
import { GAME_CONFIG, Rarity } from "@/config/game";
import { Card, Family, marketStats, position } from "./catalog";
import type { MaterialSpec } from "./materials";

export interface TrendStyle {
  hex?: string;
  material?: MaterialSpec & { main: string; accent: string };
  mood?: [string, string];
}

export interface CardView {
  /** Card id in the database (absent for demo cards). */
  id?: string;
  trendId: string;
  name: string;
  family: Family;
  style: TrendStyle;
  rarity: Rarity;
  serial: number;
  daysLeft: number;
  /** Current market index. */
  value: number;
  /** Index at the start of today (UTC). */
  dayOpen: number;
  /** Index when the card was pulled. */
  boughtAt: number;
  /** Chart points, oldest first. */
  history: number[];
  onRunway?: boolean;
}

export interface CardNumbers {
  change: number;
  pnl: number;
  worth: number;
  sell: number;
  expiryPayout: number;
  pnlCredits: number;
  ath: boolean;
  hype: "pumping" | "dumping" | null;
  multiplier: number;
}

export function cardNumbers(c: CardView): CardNumbers {
  const multiplier = GAME_CONFIG.rarityMultiplier[c.rarity];
  const perPoint = multiplier * GAME_CONFIG.market.creditsPerPoint;
  const worth = Math.round(c.value * perPoint);
  const change = c.dayOpen ? c.value / c.dayOpen - 1 : 0;
  const t = GAME_CONFIG.cards.hypeThreshold;
  return {
    change,
    pnl: c.boughtAt ? c.value / c.boughtAt - 1 : 0,
    worth,
    sell: Math.floor(worth * (1 - GAME_CONFIG.cards.sellFee)),
    expiryPayout: Math.floor(worth * GAME_CONFIG.cards.expirySellRate),
    pnlCredits: Math.round((c.value - c.boughtAt) * perPoint),
    ath: c.history.length > 1 && c.value >= Math.max(...c.history),
    hype: change >= t ? "pumping" : change <= -t ? "dumping" : null,
    multiplier,
  };
}

/** Demo card (lab page) → view. */
export function demoView(card: Card): CardView {
  const s = marketStats(card.trend.id);
  const p = position(card, s);
  const t = card.trend;
  return {
    trendId: t.id,
    name: t.name,
    family: t.family,
    style: t.hex ? { hex: t.hex } : t.material ? { material: t.material } : t.mood ? { mood: t.mood } : {},
    rarity: card.rarity,
    serial: card.serial,
    daysLeft: card.daysLeft,
    value: s.value,
    dayOpen: s.history[s.history.length - 2],
    boughtAt: p.boughtAt,
    history: s.history,
  };
}
