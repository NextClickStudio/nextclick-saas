// The owner's private paper wallet: pretend SOL, real curve prices (see 020_paper.sql). Never shown to users:
// it only appears where the lab key is saved in this browser.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { readLocal, rpc } from "./supabase";

/** [mint, symbol, tokens, cost SOL, entry mc, mc now, value SOL, pnl SOL, tp, stop, until ms, opened ms] */
export type PaperPos = [string, string | null, number, number, number, number | null, number, number, number | null, number | null, number | null, number];
/** [mint, symbol, 1 buy | 2 sell, SOL, mc, pnl, reason, ms] */
export type PaperFill = [string, string | null, 1 | 2, number, number, number | null, string, number];
export type PaperState = {
  now: number;
  sol: number;
  start: number;
  equity: number;
  positions: PaperPos[];
  fills: PaperFill[];
  stats: { trades: number; wins: number; pnl: number; best: number | null; worst: number | null };
};
export type BotRow = {
  bot: string;
  open: number;
  trades: number;
  wins: number;
  pnl: number;
  avg: number | null;
  med: number | null;
  best: number | null;
  worst: number | null;
  tp: number;
  stop: number;
  time: number;
  since: number;
  last: [string, string | null, number, string, number][];
};

export const labKey = () => readLocal<string | null>("yo:lab", null);
export const paperId = () => readLocal<string | null>("yo:paper", null);
export const paperState = (id: string) => rpc<PaperState>("yr_paper_state", { p_acct: id });
export const paperBuy = (id: string, mint: string, sol: number, plan?: { tp: number; stop: number; minutes: number } | null) =>
  rpc("yr_paper_buy", { p_acct: id, p_mint: mint, p_sol: sol, p_tp: plan?.tp ?? null, p_stop: plan?.stop ?? null, p_minutes: plan?.minutes ?? null });
export const paperSell = (id: string, mint: string, frac = 1) => rpc("yr_paper_sell", { p_acct: id, p_mint: mint, p_frac: frac, p_reason: "manual" });

/** asks yr-px to read these coins' pools from DexScreener (coins past pump.fun's curve); never throws */
export async function refreshPx(mints: string[]) {
  if (!mints.length) return;
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/yr-px`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ mints: mints.slice(0, 10) }),
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    /* the curve price, or the last one, will do */
  }
}
