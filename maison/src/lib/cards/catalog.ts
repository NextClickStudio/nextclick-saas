/**
 * The trend catalogue: every card points to one of these trends.
 * Live values come from the database (Google Trends, every hour); `sampleHistory`
 * produces demo numbers for the lab page and the starter history.
 */
import { GAME_CONFIG, RARITIES, Rarity } from "@/config/game";
import { createRng } from "../rng";
import type { MaterialSpec } from "./materials";

export const FAMILIES = ["piece", "color", "material", "detail", "aesthetic"] as const;
export type Family = (typeof FAMILIES)[number];

export const FAMILY_LABELS: Record<Family, string> = {
  piece: "Piece",
  color: "Colour",
  material: "Material",
  detail: "Detail",
  aesthetic: "Aesthetic",
};

export interface Trend {
  id: string;
  name: string;
  family: Family;
  /** What we search for on the trend data source (e.g. Google Trends). */
  query?: string;
  /** Colour cards: the colour itself. */
  hex?: string;
  /** Material cards: texture + its colours. */
  material?: MaterialSpec & { main: string; accent: string };
  /** Aesthetic cards: two mood colours. */
  mood?: [string, string];
}

const piece = (id: string, name: string): Trend => ({ id, name, family: "piece" });
const detail = (id: string, name: string): Trend => ({ id, name, family: "detail" });
const color = (id: string, name: string, hex: string): Trend => ({ id, name, family: "color", hex });
const material = (id: string, name: string, m: Trend["material"]): Trend => ({ id, name, family: "material", material: m });
const aesthetic = (id: string, name: string, mood: [string, string]): Trend => ({ id, name, family: "aesthetic", mood });

export const TRENDS: Trend[] = [
  // Pieces
  piece("ballet-flats", "Ballet Flats"),
  piece("barrel-jeans", "Barrel Jeans"),
  piece("trench-coat", "Trench Coat"),
  piece("slip-dress", "Slip Dress"),
  piece("long-sleeve", "Long Sleeve"),
  piece("bomber", "Bomber Jacket"),
  piece("maxi-skirt", "Maxi Skirt"),
  piece("bubble-skirt", "Bubble Skirt"),
  piece("mary-janes", "Mary Janes"),
  piece("kitten-heels", "Kitten Heels"),
  piece("wide-leg", "Wide-Leg Trousers"),
  piece("shearling", "Shearling Coat"),
  piece("corset", "Corset Top"),
  piece("capri", "Capri Pants"),
  piece("knit-polo", "Knit Polo"),
  piece("cape", "Cape"),
  // Colours
  color("butter", "Butter Yellow", "#f0dc98"),
  color("bordeaux", "Bordeaux", "#651828"),
  color("mocha", "Mocha Mousse", "#8a6552"),
  color("cobalt", "Cobalt", "#1f3fa3"),
  color("powder", "Powder Blue", "#b6c8da"),
  color("sage", "Sage", "#9dab8b"),
  color("cherry", "Cherry Red", "#a3172c"),
  color("chocolate", "Chocolate", "#47291e"),
  color("lilac", "Lilac", "#b8a5cf"),
  color("tomato", "Tomato Red", "#d33a2c"),
  color("mint", "Mint", "#bfe0cc"),
  color("silver", "Silver", "#b9bcc1"),
  // Materials
  material("suede", "Suede", { id: "plain", main: "#a0713f", accent: "#7c5530" }),
  material("leather", "Leather", { id: "leather", main: "#1f1d1b", accent: "#3a3733" }),
  material("denim", "Denim", { id: "denim", main: "#35507a", accent: "#6d86ad" }),
  material("crochet", "Crochet", { id: "knit", main: "#e8dcc4", accent: "#b9a584", scale: 1.6 }),
  material("sequins", "Sequins", { id: "sequins", main: "#8f8f96", accent: "#d9d9df", scale: 1.3 }),
  material("plisse", "Plissé", { id: "plisse", main: "#c9b8d8", accent: "#ffffff", scale: 1.4 }),
  material("tweed", "Tweed", { id: "tweed", main: "#6f5b4b", accent: "#d8b4a0", scale: 1.6 }),
  material("satin", "Satin", { id: "satin", main: "#b7c3cf", accent: "#ffffff" }),
  material("houndstooth", "Houndstooth", { id: "houndstooth", main: "#efe9dd", accent: "#161514", scale: 1.8 }),
  material("pinstripe", "Pinstripe", { id: "stripes", main: "#23252b", accent: "#8c8e94", scale: 0.6 }),
  material("polka", "Polka Dots", { id: "polka", main: "#161514", accent: "#f3efe7", scale: 1.6 }),
  material("gingham", "Gingham", { id: "check", main: "#f3efe7", accent: "#c0392b", scale: 1.4 }),
  material("florals", "Florals", { id: "floral", main: "#f1e3e0", accent: "#c65d7b", scale: 1.5 }),
  // Details
  detail("bows", "Bows"),
  detail("fringe", "Fringe"),
  detail("studs", "Studs"),
  detail("ruffles", "Ruffles"),
  detail("buckles", "Big Buckles"),
  detail("peplum", "Peplum"),
  detail("cut-outs", "Cut-Outs"),
  detail("drop-waist", "Drop Waist"),
  detail("collars", "Statement Collars"),
  detail("pearls", "Pearls"),
  detail("chains", "Chains"),
  detail("feathers", "Feathers"),
  // Aesthetics
  aesthetic("quiet-luxury", "Quiet Luxury", ["#d9cbb5", "#8b7a66"]),
  aesthetic("y2k", "Y2K", ["#f4a6d7", "#9ad8f5"]),
  aesthetic("boho", "Boho", ["#d9a066", "#8a5a3c"]),
  aesthetic("mob-wife", "Mob Wife", ["#3b1f16", "#b08a5a"]),
  aesthetic("indie-sleaze", "Indie Sleaze", ["#1b1b1b", "#c5243d"]),
  aesthetic("office-siren", "Office Siren", ["#2c2c30", "#9aa3ad"]),
  aesthetic("balletcore", "Balletcore", ["#f6dfe0", "#e8b7bf"]),
  aesthetic("gorpcore", "Gorpcore", ["#58623a", "#d8752f"]),
  aesthetic("old-money", "Old Money", ["#1f3448", "#e7dfcf"]),
  aesthetic("minimal", "Minimalism", ["#f1eee8", "#bdb7ad"]),
  aesthetic("western", "Western", ["#b5773e", "#e8d3b0"]),
  aesthetic("coastal", "Coastal", ["#a9c6d6", "#f2ead8"]),
];

/** Search keyword for each trend: fashion-specific so "Bordeaux" isn't the city. */
const QUERY_OVERRIDES: Record<string, string> = {
  "long-sleeve": "long sleeve top",
  cape: "cape coat",
  "wide-leg": "wide leg pants",
  mocha: "mocha mousse",
  sage: "sage green dress",
  chocolate: "chocolate brown dress",
  mint: "mint green dress",
  crochet: "crochet top",
  tweed: "tweed jacket",
  satin: "satin dress",
  pinstripe: "pinstripe suit",
  plisse: "pleated skirt",
  sequins: "sequin dress",
  polka: "polka dot dress",
  florals: "floral dress",
  gingham: "gingham dress",
  bows: "bow top",
  fringe: "fringe jacket",
  studs: "studded boots",
  ruffles: "ruffle dress",
  buckles: "belt buckle",
  peplum: "peplum top",
  "cut-outs": "cut out dress",
  "drop-waist": "drop waist dress",
  collars: "statement collar",
  pearls: "pearl necklace",
  chains: "chain necklace",
  feathers: "feather dress",
  y2k: "y2k fashion",
  minimal: "minimalist fashion",
  western: "western boots",
  coastal: "coastal grandmother",
  "mob-wife": "mob wife aesthetic",
  "old-money": "old money outfit",
  "quiet-luxury": "quiet luxury",
  "indie-sleaze": "indie sleaze",
  "office-siren": "office siren",
  balletcore: "balletcore",
  gorpcore: "gorpcore",
};

export function trendQuery(t: Trend): string {
  if (t.query) return t.query;
  if (QUERY_OVERRIDES[t.id]) return QUERY_OVERRIDES[t.id];
  const n = t.name.toLowerCase();
  switch (t.family) {
    case "piece":
      return n;
    case "color":
      return `${n} dress`;
    case "material":
    case "detail":
      return n;
    case "aesthetic":
      return `${n} aesthetic`;
  }
}

export const trendById = (id: string) => TRENDS.find((t) => t.id === id);

/** Demo market history: a deterministic daily random walk per trend. */
export function sampleHistory(trendId: string): number[] {
  const rng = createRng(`market:${trendId}`);
  const days = GAME_CONFIG.market.historyDays;
  const drift = rng.range(-0.012, 0.016);
  const vol = rng.range(0.01, 0.05);
  let v = GAME_CONFIG.market.baseValue * rng.range(0.6, 1.6);
  const out: number[] = [];
  for (let i = 0; i < days; i++) {
    out.push(Math.round(v * 10) / 10);
    v = Math.max(8, v * (1 + drift + rng.range(-vol, vol)));
  }
  return out;
}

export interface MarketStats {
  value: number;
  /** Day-on-day change, e.g. 0.124 = +12.4% */
  change: number;
  /** Change over the last 7 days. */
  week: number;
  history: number[];
}

export function marketStats(trendId: string): MarketStats {
  const history = sampleHistory(trendId);
  const value = history[history.length - 1];
  const prev = history[history.length - 2];
  const weekAgo = history[Math.max(0, history.length - 8)];
  return { value, change: value / prev - 1, week: value / weekAgo - 1, history };
}

/** Days the player has held the card. */
export const daysHeld = (card: Card) => GAME_CONFIG.cards.lifespanDays - card.daysLeft;

export interface Position {
  /** Index when the card was pulled from the pack. */
  boughtAt: number;
  /** Gain since the pull, e.g. 0.34 = +34%. */
  pnl: number;
  /** Credits gained (or lost) since the pull, before the sell fee. */
  pnlCredits: number;
  /** Index is at its highest in the chart window. */
  ath: boolean;
  hype: "pumping" | "dumping" | null;
}

/** How the card has done since it was pulled, like a coin in a wallet. */
export function position(card: Card, stats = marketStats(card.trend.id)): Position {
  const h = stats.history;
  const boughtAt = h[Math.max(0, h.length - 1 - daysHeld(card))];
  const perPoint = GAME_CONFIG.rarityMultiplier[card.rarity] * GAME_CONFIG.market.creditsPerPoint;
  const t = GAME_CONFIG.cards.hypeThreshold;
  return {
    boughtAt,
    pnl: stats.value / boughtAt - 1,
    pnlCredits: Math.round((stats.value - boughtAt) * perPoint),
    ath: stats.value >= Math.max(...h),
    hype: stats.change >= t ? "pumping" : stats.change <= -t ? "dumping" : null,
  };
}

/** Credits a card is worth right now. */
export function cardValue(card: Card, stats = marketStats(card.trend.id)): number {
  return Math.round(stats.value * GAME_CONFIG.rarityMultiplier[card.rarity] * GAME_CONFIG.market.creditsPerPoint);
}

/** Credits you get if you sell now (after the fee). */
export function sellValue(card: Card, stats = marketStats(card.trend.id)): number {
  return Math.floor(cardValue(card, stats) * (1 - GAME_CONFIG.cards.sellFee));
}

/** A card the player owns: a trend + rarity + serial number. */
export interface Card {
  trend: Trend;
  rarity: Rarity;
  serial: number;
  /** Days left before the card expires and is auto-sold. */
  daysLeft: number;
}

/** Draws one card from a seed using the configured odds. */
export function drawCard(seed: string, filter?: { family?: Family; rarity?: Rarity }): Card {
  const rng = createRng(seed);
  const pool = filter?.family ? TRENDS.filter((t) => t.family === filter.family) : TRENDS;
  const rarity = filter?.rarity ?? rng.weighted(RARITIES.map((r) => [r, GAME_CONFIG.pack.rarityOdds[r]] as const));
  return { trend: rng.pick(pool), rarity, serial: rng.int(1, 9999), daysLeft: rng.int(1, GAME_CONFIG.cards.lifespanDays) };
}
