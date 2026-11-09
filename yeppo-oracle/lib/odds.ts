// The odds of coins like this one (yr_odds, rebuilt each night from the last days of pump.fun coins): how often a coin
// at this age, this price against launch, from this kind of creator, then made ×2 and ×3. Checked on days it was not
// built from: each fifth of coins came out as predicted (see migration 074).
import type { Creator, DevNow } from "./decide";
import { deadFarm } from "./decide";

/** [step, creator kind, price bucket, creator sold everything, coins, share that made ×2, share that made ×3, median
 *  seconds to the high for those that made ×2] */
export type OddsRow = [number, string, number, boolean, number, number, number, (number | null)?];
export type Odds = { p2: number; p3: number; n: number; ageS: number; pk: number | null };

/** the 30 s steps the table has: 30 s, 1, 2, 4, 8, 12 and 16 minutes */
const STEPS = [1, 2, 4, 8, 16, 24, 32];

export function creatorKind(c: Creator | null): string {
  if (!c || c.total <= 1) return "first";
  if (c.rugs >= 2 && c.rugs >= c.coins.length * 0.4) return "rugger";
  if (deadFarm(c)) return "deadfarm";
  return c.rugs > 0 ? "somerug" : "clean";
}

const bucket = (x: number) => (x < 1.2 ? 0 : x < 2 ? 1 : x < 3.5 ? 2 : 3);

/** the odds by creator kind directly ("*" when yeppo can't tell the kind) */
export function oddsFor(rows: OddsRow[], ageS: number, priceX: number, kind: string, dout: boolean): Odds | null {
  if (!rows.length || ageS > 17 * 60 || !(priceX > 0)) return null;
  let i = STEPS[0];
  for (const s of STEPS) if (s * 30 <= ageS) i = s;
  const xb = bucket(priceX);
  const hit = rows.find((r) => r[0] === i && r[1] === kind && r[2] === xb && r[3] === dout) ?? rows.find((r) => r[0] === i && r[1] === "*" && r[2] === xb && r[3] === dout);
  return hit ? { p2: hit[5], p3: hit[6], n: hit[4], ageS: i * 30, pk: hit[7] ?? null } : null;
}

/** the odds for a coin now: null past 16 minutes, without a price, or when too few coins look like it */
export function oddsOf(rows: OddsRow[], a: { ageS: number | null; priceX: number | null; creator: Creator | null; dev: DevNow | null }): Odds | null {
  if (a.ageS == null || a.priceX == null) return null;
  return oddsFor(rows, a.ageS, a.priceX, creatorKind(a.creator), !!a.dev?.out);
}
