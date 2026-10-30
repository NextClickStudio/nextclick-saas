// yeppo.it/api/read: the one call the extension and the coin page need (see app/api/read).
import type { Check, Creator, Decision, DevNow, Pulse } from "./decide";

export type Read = {
  mint: string;
  symbol: string | null;
  name: string | null;
  uri: string | null;
  image: string | null;
  /** where it trades: "pump.fun" while on the curve, else the DEX */
  venue: string;
  url: string | null;
  t0: number | null;
  mcUsd: number | null;
  /** price now and at its high, as multiples of the pump.fun launch price (curve coins) */
  priceX: number | null;
  athX: number | null;
  liqUsd: number | null;
  holders: number | null;
  decision: Decision;
  checks: Check[];
  pulse: Pulse | null;
  creator: Creator | null;
  dev: DevNow | null;
  /** this coin's own price / launch: [seconds from launch, price] for its first 20 minutes */
  path: [number, number][];
};

export async function readCoin(mint: string): Promise<Read> {
  const r = await fetch(`/api/read?mint=${mint}`);
  const j = (await r.json()) as Read & { error?: string };
  if (!r.ok || j.error) throw new Error(j.error ?? "yeppo is busy");
  return j;
}
