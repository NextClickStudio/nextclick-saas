// yeppo.it/api/read: the one call the extension needs to answer "should I buy this?" (see app/api/read).
import type { Check, Decision, Flag, Plan, Tone } from "./oracle";
import type { Odds } from "./types";

export type Read = {
  mint: string;
  tracked: boolean;
  old: boolean;
  src: "board" | "live";
  symbol: string | null;
  name: string | null;
  uri: string | null;
  t0: number | null;
  mc: number | null;
  decision: Decision | null;
  checks: Check[];
  verdict: { label: string; tone: Tone; score: number; line: string } | null;
  odds: Odds | null;
  flags: Flag[];
  plan: Plan | null;
};

export async function readCoin(mint: string): Promise<Read> {
  const r = await fetch(`/api/read?mint=${mint}`);
  const j = (await r.json()) as Read & { error?: string };
  if (!r.ok || j.error) throw new Error(j.error ?? "yeppo is busy");
  return j;
}
