// Bonding curve for bot shares — mirrors bm_trade in SQL.
export const P0 = 1;
export const K = 0.001;
export const SHARE_FEE = 0.02;

export const priceAt = (supply: number) => P0 + K * supply;
export const mcapAt = (supply: number) => priceAt(supply) * supply;

/** Shares received for spending `pts` (fee included). */
export function sharesForPts(pts: number, supply: number) {
  const net = pts * (1 - SHARE_FEE);
  const b = P0 + K * supply;
  return (-b + Math.sqrt(b * b + 2 * K * net)) / K;
}

/** Pts received for selling `n` shares (fee included). */
export function ptsForShares(n: number, supply: number) {
  const m = Math.min(n, supply);
  return m * (P0 + K * (supply - m / 2)) * (1 - SHARE_FEE);
}
