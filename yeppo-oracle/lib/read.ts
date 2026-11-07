// yeppo.it/api/read: the one call the extension and the coin page need (see app/api/read).
import type { Check, Creator, Decision, DevNow, Outlook, Pulse, Risk } from "./decide";
import type { LiveBase } from "./live";
import type { Odds } from "./odds";
import type { TheCoin } from "./thecoin";
import type { Deep } from "./deep";
import type { Origin } from "./origin";
import type { XSignals } from "./xsignals";

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
  /** who could dump it on a buyer: snipers, the biggest wallet, a big holder selling, proven wallets in it */
  risk?: Risk | null;
  /** why who holds it keeps it from being a Momentum, even when buyers pile in (the live call respects it) */
  hold?: string | null;
  /** a reason to get out now (creator selling, a big holder dumping, the top traders gone): the badge says Exit */
  exit?: string | null;
  /** the one thing to keep an eye on when the coin is an Opportunity (a holder that is not an insider) */
  watch?: string | null;
  /** how often coins like this one made ×2 and ×3 from this point (pump.fun curve, first 16 minutes) */
  odds?: Odds | null;
  /** no failed check, holder warning or exit reason: the panel's live read may turn the call green */
  clear?: boolean;
  /** the other coins with this name: the original, the leader, and whether this one is THE coin */
  thecoin?: TheCoin | null;
  /** where the coin comes from on X: the post or account its creator linked, and who is behind it */
  origin?: Origin | null;
  /** what X says beyond the link: the same account or post on other coins, and how fast the post spreads */
  xs?: XSignals | null;
  /** the deeper checks next to the verdict (information: they never change it) */
  deep?: Deep | null;
  /** the launch bundle read from the chain: wallets of the first 2 blocks, what they took, what they hold now */
  launch?: { wallets: number; took: number; now: number | null } | null;
  /** the launch bundle still on its way from the chain: about how many seconds until it is in */
  launchEta?: number | null;
  /** where the launch read stands: in (exact insiders), reading (countdown), unavailable, null (coin past 2 hours) */
  launchState?: "in" | "reading" | "unavailable" | null;
  /** which attempt of the launch read is running (1-3) */
  launchTry?: number | null;
  /** which parts of the read are in for real (holders on chain, creator history, launch bundle, X origin) */
  ready?: { holders: boolean; creator: boolean; launch: boolean; x: boolean };
  /** DexScreener boosts paid for right now */
  boosts?: number;
  pro: boolean;
  /** no valid Pro key: nothing but the way in (reason: nokey, unknown, expired, devices, nodevice) */
  locked?: boolean;
  reason?: string;
  /** where the panel's live trades start from (coins on pump.fun's curve) */
  live?: LiveBase | null;
};

export async function readCoin(mint: string, key?: string | null, dev?: string | null): Promise<Read> {
  const q = new URLSearchParams({ mint });
  if (key) q.set("key", key);
  if (dev) q.set("dev", dev);
  // never wait more than 12 s: a request left hanging would stop the panel's refresh until a reload
  const r = await fetch(`/api/read?${q}`, { signal: AbortSignal.timeout(12_000) });
  const j = (await r.json()) as Read & { error?: string };
  if (!r.ok || j.error) throw new Error(j.error ?? "yeppo is busy");
  return j;
}
