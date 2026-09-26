/**
 * MAISON — game configuration.
 *
 * Every number of the game lives here: probabilities, weights, thresholds,
 * durations. Change a value here and the whole app follows.
 */

export const RARITIES = ["common", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

export const GAME_CONFIG = {
  /** Daily pack. */
  pack: {
    cardsPerPack: 5,
    /** Base odds per card (must sum to 1). */
    rarityOdds: { common: 0.7, rare: 0.22, epic: 0.07, legendary: 0.01 } as Record<Rarity, number>,
  },

  /**
   * Garment generator: how "extreme" a garment is for each rarity.
   * 0 = clean everyday piece, 1 = sculptural runway piece.
   * The generator picks a random intensity inside the range.
   */
  garment: {
    intensity: {
      common: [0.0, 0.22],
      rare: [0.3, 0.52],
      epic: [0.55, 0.8],
      legendary: [0.85, 1.0],
    } as Record<Rarity, [number, number]>,
    /** How many "statement features" (big sleeves, ruff, train...) per rarity. */
    statementFeatures: { common: [0, 0], rare: [1, 1], epic: [2, 3], legendary: [3, 5] } as Record<
      Rarity,
      [number, number]
    >,
    /** Chance that the garment uses a patterned / textured material instead of a plain one. */
    patternChance: { common: 0.3, rare: 0.5, epic: 0.6, legendary: 0.7 } as Record<Rarity, number>,
    /** Chance of a special finish (metallic, iridescent) — only rare pieces get them. */
    specialFinishChance: { common: 0, rare: 0.05, epic: 0.2, legendary: 0.45 } as Record<Rarity, number>,
  },

  /** Lab page. */
  lab: {
    gridSize: 50,
  },
} as const;
