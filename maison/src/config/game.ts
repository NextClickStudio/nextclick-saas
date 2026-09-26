/**
 * MAISON — game configuration.
 *
 * Every number of the game lives here: probabilities, prices, rewards, durations.
 * The server enforces the same numbers from the `maison_config` table: run
 * `ADMIN_EMAILS=you@x.com npm run seed:sql` and apply the output after changing this file.
 */

export const RARITIES = ["common", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

export const GAME_CONFIG = {
  /** A season is one race: everyone starts with the same credits, the richest maison at the end wins. */
  season: {
    days: 7,
    startCredits: 10000,
    /** Top places that get a trophy on their profile. */
    trophies: 3,
  },

  /** Daily free pack. */
  pack: {
    cardsPerPack: 5,
    /** Base odds per card (must sum to 1). */
    rarityOdds: { common: 0.7, rare: 0.22, epic: 0.07, legendary: 0.01 } as Record<Rarity, number>,
    /** Each day of streak moves this much probability from common to the rarer tiers… */
    streakBonusPerDay: 0.01,
    /** …up to this cap. */
    streakBonusCap: 0.1,
    /** Extra pack bought with in-game credits (never real money). */
    extraPackCredits: 6000,
  },

  /** A card is worth: trend price × rarity multiplier × creditsPerPoint. */
  rarityMultiplier: { common: 1, rare: 1.25, epic: 1.5, legendary: 2 } as Record<Rarity, number>,

  /** Market: every trend has a price that follows Google search interest. */
  market: {
    baseValue: 100,
    /** Days of history drawn on the charts. */
    historyDays: 30,
    creditsPerPoint: 10,
    /** Selling keeps (1 - sellFee) of the card's worth. Buying costs the full worth (common card). */
    sellFee: 0.05,
    /** Day moves above this show "Hot" / below minus this show "Cooling". */
    hypeThreshold: 0.03,
  },

  /** The daily forecast: will these trends rise or fall? A right call pays after 24 hours. */
  forecast: {
    callsPerDay: 5,
    winCredits: 500,
    resolveHours: 24,
    /** Minimum calls to appear on the forecasters board. */
    minCallsForBoard: 5,
  },
} as const;

export const cardWorth = (price: number, rarity: Rarity) =>
  Math.round(price * GAME_CONFIG.rarityMultiplier[rarity] * GAME_CONFIG.market.creditsPerPoint);
export const sellPrice = (price: number, rarity: Rarity) => Math.floor(cardWorth(price, rarity) * (1 - GAME_CONFIG.market.sellFee));
