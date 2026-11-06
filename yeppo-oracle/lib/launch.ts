// The launch bundle, read from the chain: the wallets that bought in a coin's first 2 blocks and how much each got.
// yeppo's own capture misses those buys (a launch with bundled buys has its logs cut), but each transaction's token
// balances stay whole, so they are read from there, from the free public Solana node (no paid or keyed RPC: no
// credits to run out): the coin's signatures, then its 2 launch blocks whole. The reading itself is done by the edge
// function yr-launch (yeppo-royale/supabase/functions/yr-launch); a launch is kept only when it was read in full.
// Who reads it: the edge function yr-launch on Supabase, in the background for every coin that reaches 50 trades, and
// right away for a coin someone opens before that (the public node turns Vercel's shared servers away, and the coin
// read answers in 2 s anyway). The coin read only books it (yr_launch_claim), starts that read, and tells the panel
// where it stands.
import { after } from "next/server";
import { DB_HEADERS } from "./access";
import { SUPABASE_URL } from "./config";

export type Launch = { slot: number | null; dev: string | null; wallets: [string, number][]; took: number };


// launches that are in, on this server (they never change)
const cache = new Map<string, Launch>();

export type LaunchRead = {
  launch: Launch | null;
  /** in (the insiders are exact), reading (on its way), unavailable (nothing to read, or 3 attempts without an answer),
   *  null (a coin past its first 2 hours: no launch read at all) */
  state: "in" | "reading" | "unavailable" | null;
  /** about how many seconds until it is in, while reading */
  eta: number | null;
  /** which attempt is running (1-3), while reading */
  attempt: number | null;
};

type Claim = { launch?: Launch; claimed?: boolean; final?: boolean; n?: number; age_ms?: number };

async function claim(mint: string): Promise<Claim | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_launch_claim`, { method: "POST", headers: DB_HEADERS, body: JSON.stringify({ p_mint: mint }), signal: AbortSignal.timeout(1500) });
    return r.ok ? ((await r.json()) as Claim) : null;
  } catch {
    return null;
  }
}

/** where a coin's launch read stands, for the coin read: the launch when it is in, else a booked read (started on
 *  on yr-launch when this call is the one that booked it) with about how long it still takes */
export async function launchRead(mint: string, ageS: number | null): Promise<LaunchRead> {
  const hit = cache.get(mint);
  if (hit) return { launch: hit, state: "in", eta: null, attempt: null };
  if (ageS == null || ageS > 7200) return { launch: null, state: null, eta: null, attempt: null };
  // under 10 seconds its second block may still be landing: a read now would miss buys
  if (ageS < 10) return { launch: null, state: "reading", eta: Math.ceil(10 - ageS) + 8, attempt: null };
  const c = await claim(mint);
  if (!c) return { launch: null, state: "reading", eta: null, attempt: null };
  if (c.launch) {
    if (cache.size > 3000) cache.clear();
    cache.set(mint, c.launch);
    return { launch: c.launch, state: "in", eta: null, attempt: null };
  }
  if (c.final) return { launch: null, state: "unavailable", eta: null, attempt: null };
  if (c.claimed)
    after(() =>
      fetch(`${SUPABASE_URL}/functions/v1/yr-launch?mint=${mint}`, { headers: { "x-yeppo-secret": process.env.YEPPO_API_SECRET ?? "" }, signal: AbortSignal.timeout(2000) }).catch(
        () => undefined,
      ),
    );
  const n = c.n ?? 1;
  const ageMs = c.age_ms ?? 0;
  // the third attempt came and went without an answer
  if (!c.claimed && n >= 3 && ageMs > 30_000) return { launch: null, state: "unavailable", eta: null, attempt: null };
  // a read takes 1-3 s (two blocks), a few more when the node asks to slow down, and the poll that brings it in
  return { launch: null, state: "reading", eta: Math.max(1, Math.ceil(6 - ageMs / 1000)), attempt: n };
}
