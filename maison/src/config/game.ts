/**
 * MAISON — game configuration.
 *
 * Every number of the game lives here: probabilities, multipliers, thresholds,
 * durations. The server enforces the same numbers from the `maison_config`
 * table: run `ADMIN_EMAILS=you@x.com npm run seed:sql` and apply the output after changing this file.
 */

export const RARITIES = ["common", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

export const GAME_CONFIG = {
  /** Daily pack. */
  pack: {
    cardsPerPack: 5,
    /** Base odds per card (must sum to 1). */
    rarityOdds: { common: 0.7, rare: 0.22, epic: 0.07, legendary: 0.01 } as Record<Rarity, number>,
    /** Each day of streak moves this much probability from common to the rarer tiers… */
    streakBonusPerDay: 0.01,
    /** …up to this cap. */
    streakBonusCap: 0.1,
  },

  /** A new maison starts with these credits. */
  house: {
    startCredits: 1000,
  },

  /** Rarity boosts a card's market score: a legendary card doubles its trend's move. */
  rarityMultiplier: { common: 1, rare: 1.25, epic: 1.5, legendary: 2 } as Record<Rarity, number>,

  /** Market: every trend has an index that moves every day, like a stock. */
  market: {
    baseValue: 100,
    /** Days of history drawn on the card's chart. */
    historyDays: 30,
    /** A card's value in credits = trend index × rarity multiplier × this. */
    creditsPerPoint: 10,
  },

  /** Cards are contracts: they expire and can be sold before that. */
  cards: {
    /** Days a card stays active after it's unpacked. At expiry it's auto-sold. */
    lifespanDays: 14,
    /** Cards can be sold any time, rising or falling. Selling costs a fee (0.1 = you keep 90%). */
    sellFee: 0.1,
    /** Day moves above this show "Pumping" / below minus this show "Dumping". */
    hypeThreshold: 0.03,
    /** At expiry the card is sold at this share of its value. */
    expirySellRate: 0.5,
  },

  /** The runway: the cards that count for your maison's revenue, one per family. */
  runway: {
    slots: 5,
  },

  /** Daily duel against a maison of similar value: best % move of the day wins. */
  duel: {
    everyHours: 24,
    winCredits: 250,
    streakBonus: 50,
  },

  /** Extra packs bought with in-game credits (never real money). */
  shop: {
    extraPackCredits: 1500,
  },

  /** Lab page. */
  lab: {
    gridSize: 24,
  },
} as const;
