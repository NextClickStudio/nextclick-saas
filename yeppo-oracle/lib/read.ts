// yeppo.it/api/read: the one call the extension needs to answer "should I buy this?" (see app/api/read).
import type { Check, Decision, Flag, Plan, Tone } from "./oracle";
import type { Odds } from "./types";

export type Read = {
  mint: string;
  tracked: boolean;
  old: boolean;
  src: "board" | "live" | "market";
  /** the last 2 minutes on the pump.fun curve (market caps in SOL) */
  market?: { mc: number; ath: number; ageS: number; trades2: number; buys2: number; wallets2: number } | null;
  symbol: string | null;
  name: string | null;
  uri: string | null;
  t0: number | null;
  mc: number | null;
  decision: Decision | null;
  checks: Check[];
  /** wallets holding the coin, from RugCheck */
  holders?: number | null;
  verdict: { label: string; tone: Tone; score: number; line: string } | null;
  odds: Odds | null;
  flags: Flag[];
  plan: Plan | null;
  /** a coin yeppo did not follow from birth: where it trades, from DexScreener */
  outside?: {
    dex: string;
    url: string;
    liq: number | null;
    mcap: number | null;
    m5: { buys: number; sells: number } | null;
    h1: { buys: number; sells: number } | null;
    vol1h: number | null;
    ch5?: number | null;
    ch1?: number | null;
    born: number | null;
  } | null;
};

export async function readCoin(mint: string): Promise<Read> {
  const r = await fetch(`/api/read?mint=${mint}`);
  const j = (await r.json()) as Read & { error?: string };
  if (!r.ok || j.error) throw new Error(j.error ?? "yeppo is busy");
  return j;
}
