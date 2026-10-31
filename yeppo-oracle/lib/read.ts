// yeppo.it/api/read: the one call the extension and the coin page need (see app/api/read).
import type { Check, Creator, Decision, DevNow, Outlook, Pulse } from "./decide";

/** where the creator's SOL came from, and what the same money did before (yr_fund_read) */
export type Money = {
  checked: boolean;
  funder: string | null;
  kind: "wallet" | "exchange" | "old" | "none" | null;
  sol: number | null;
  siblings: number; // other creators paid by the same funder
  coins: number; // coins those wallets (and the funder) launched
  rugs: number;
  ran: number;
  best: number | null;
  rug_syms: string[];
  dirty: number; // early buyers tied to past rugs
  family: number; // early buyers paid by the creator or the creator's funder
};

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
  outlook: Outlook | null;
  creator: Creator | null;
  money: Money | null;
  dev: DevNow | null;
  /** this coin's own price / launch: [seconds from launch, price] for its first 20 minutes */
  path: [number, number][];
  /** sources that did not answer this time: RugCheck, or yeppo's own creator history */
  down: ("rugcheck" | "history")[];
  /** false: a free read. The live moment, the outlook and the money trail are left out (Pro). */
  pro: boolean;
};

export async function readCoin(mint: string, key?: string | null): Promise<Read> {
  const r = await fetch(`/api/read?mint=${mint}${key ? `&key=${encodeURIComponent(key)}` : ""}`);
  const j = (await r.json()) as Read & { error?: string };
  if (!r.ok || j.error) throw new Error(j.error ?? "yeppo is busy");
  return j;
}
