/**
 * A garment is a stack of "pieces": filled shapes with an ink outline,
 * plus optional inner lines (folds, seams). Parts only produce data;
 * the renderer decides how to paint it.
 */

/** Which colour a piece is painted with. */
export type FillRef = "main" | "accent" | "inner" | "ink" | "body" | "chalk" | "metal" | "none";

export interface Piece {
  /** Stacking order: higher is drawn on top. */
  z: number;
  d: string;
  fill: FillRef;
  /** Inner lines drawn on top of the fill (folds, seams, pleats). */
  lines?: string[];
  /** Apply the material pattern (default: true for "main"). */
  pattern?: boolean;
  /** Apply the volume shading (default: true). */
  shade?: boolean;
  /** Outline width (0 = no outline). */
  stroke?: number;
  /** Inner line width. */
  lineWidth?: number;
}

export const Z = {
  back: 5,
  train: 8,
  hairBack: 9,
  inner: 15,
  lower: 20,
  tiers: 21,
  top: 30,
  peplum: 32,
  sleeve: 36,
  outer: 50,
  outerFront: 52,
  outerSleeve: 55,
  collar: 60,
  belt: 65,
  detail: 70,
  bigDetail: 75,
} as const;
