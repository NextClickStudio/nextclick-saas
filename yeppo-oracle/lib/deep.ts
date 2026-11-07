// The deeper checks next to the verdict (they never change it): wallets buying the exact same amount at the launch
// (one hand split across wallets), fresh wallets among the top holders (spam wallets with a handful of transactions in
// their life), a serial launcher, a ticker copying a coin that already ran, an X account recycled from dead coins,
// buyers against sellers right now, and the user's own filters (under 30 min, under $20K and no socials; the $25K
// minimum). From yeppo's own tables (yr_deep_s) and wallet ages read on the public node by the edge function yr-fresh.
import { DB_HEADERS } from "./access";
import { SUPABASE_URL } from "./config";

export type DeepLine = { tone: "ok" | "warn" | "bad" | "info"; text: string };
export type Deep = { lines: DeepLine[]; fresh: { checked: number; fresh: number; held: number } | null; cluster: number };

type Raw = {
  early: number;
  seen: boolean;
  same_sol: { amt: number; n: number; share: number }[];
  same_tok: { pct: number; n: number; share: number }[];
  dev_24h: number;
  copy_of: { mint: string; sym: string | null; x: number; t0: number } | null;
  x_handle: string | null;
  x_other: { n: number; died: number } | null;
  buyers5: number;
  buyers5_before: number;
  buys5: number;
  sells5: number;
};

const rawCache = new Map<string, { t: number; v: Raw | null }>();
const freshCache = new Map<string, { t: number; v: Record<string, [number, number | null]> }>();

async function raw(mint: string): Promise<Raw | null> {
  const hit = rawCache.get(mint);
  if (hit && Date.now() - hit.t < 15_000) return hit.v;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_deep_s`, { method: "POST", headers: DB_HEADERS, body: JSON.stringify({ p_mint: mint }), signal: AbortSignal.timeout(2500) });
    const v = r.ok ? ((await r.json()) as Raw | null) : null;
    if (rawCache.size > 500) rawCache.clear();
    rawCache.set(mint, { t: Date.now(), v });
    return v;
  } catch {
    return hit?.v ?? null;
  }
}

/** the top holders' ages: what is known now; the edge function looks up the rest for the next read */
async function ages(mint: string, who: string[]): Promise<Record<string, [number, number | null]>> {
  const hit = freshCache.get(mint);
  if (hit && Date.now() - hit.t < 30_000 && Object.keys(hit.v).length >= Math.min(who.length, 10)) return hit.v;
  if (!who.length) return {};
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/yr-fresh?who=${who.slice(0, 15).join(",")}`, {
      headers: { "x-yeppo-secret": process.env.YEPPO_API_SECRET ?? "" },
      signal: AbortSignal.timeout(1500),
    });
    const v = r.ok ? ((await r.json()) as Record<string, [number, number | null]>) : {};
    if (freshCache.size > 500) freshCache.clear();
    freshCache.set(mint, { t: Date.now(), v });
    return v;
  } catch {
    return hit?.v ?? {};
  }
}

const pc = (x: number) => `${x >= 0.1 ? Math.round(x * 100) : (x * 100).toFixed(1)}%`;

export type DeepData = { d: Raw | null; ag: Record<string, [number, number | null]> };

/** started as soon as RugCheck's top holders are known, so it runs while the rest of the read does */
export async function deepData(mint: string, owners: string[]): Promise<DeepData> {
  const [d, ag] = await Promise.all([raw(mint), ages(mint, owners)]);
  return { d, ag };
}

export function deepRead(
  data: DeepData,
  o: { tops: { owner: string; pct: number }[]; ageS: number | null; mcUsd: number | null; social: boolean },
): Deep | null {
  const { d, ag } = data;
  if (!d) return null;
  const lines: DeepLine[] = [];
  const now = Date.now();

  // one hand split across wallets: the same SOL amount, or the same share of the supply, bought by 3+ wallets
  const s1 = d.same_sol[0], s2 = d.same_tok[0];
  const big = [s1 && { n: s1.n, share: s1.share, text: `${s1.n} wallets bought exactly ${s1.amt} SOL in the first 3 minutes` }, s2 && { n: s2.n, share: s2.share, text: `${s2.n} wallets bought ${s2.pct}% of the supply each at the launch` }]
    .filter((x): x is { n: number; share: number; text: string } => !!x)
    .sort((a, b) => b.share - a.share)[0];
  const cluster = big?.share ?? 0;
  // a group under 1% of the supply can't move the price: not worth a line
  if (big && big.share >= 0.01) lines.push({ tone: big.share >= 0.05 ? "bad" : "warn", text: `${big.text}: likely one buyer, ${pc(big.share)} of the supply.` });
  else if (d.seen && d.early >= 5) lines.push({ tone: "ok", text: `No same-amount buys among the first ${d.early} buyers.` });
  else if (!d.seen && (o.ageS ?? 0) > 1200) lines.push({ tone: "info", text: "Launch buys are past yeppo's 20-minute window: same-amount check not run." });

  // fresh wallets among the real top holders: 10 transactions or fewer, or a first one under 48 hours ago
  const checked = o.tops.slice(0, 15).filter((t) => ag[t.owner]);
  let fresh: Deep["fresh"] = null;
  if (checked.length >= 5) {
    const fw = checked.filter((t) => {
      const [n, first] = ag[t.owner];
      return n <= 10 || (first != null && now - first < 48 * 3_600_000);
    });
    const held = fw.reduce((a, t) => a + t.pct, 0);
    fresh = { checked: checked.length, fresh: fw.length, held };
    if (fw.length >= 3 || held >= 0.1)
      lines.push({ tone: held >= 0.15 ? "bad" : "warn", text: `${fw.length} of the top ${checked.length} holders are fresh wallets (a handful of transactions in their life), holding ${pc(held)}.` });
    else lines.push({ tone: "ok", text: `Top holders are wallets with a history (${fw.length} fresh of ${checked.length}).` });
  } else if (o.tops.length >= 5) lines.push({ tone: "info", text: "Checking how old the top holders are: in the next read." });

  if (d.dev_24h >= 20) lines.push({ tone: "bad", text: `Serial launcher: ${d.dev_24h} coins from this creator in 24 hours.` });
  else if (d.dev_24h >= 5) lines.push({ tone: "warn", text: `Serial launcher: ${d.dev_24h} coins from this creator in 24 hours.` });

  if (d.copy_of) lines.push({ tone: "warn", text: `Copies $${(d.copy_of.sym ?? "").replace(/^\$/, "")}, which already did ×${d.copy_of.x} this week.` });

  if (d.x_handle && d.x_other && d.x_other.n >= 1) {
    const share = d.x_other.died / d.x_other.n;
    if (d.x_other.n >= 2 && share >= 0.5) lines.push({ tone: "warn", text: `The X account @${d.x_handle} was used by ${d.x_other.n} other coins this fortnight; ${d.x_other.died} of them died.` });
    else lines.push({ tone: "info", text: `The X account @${d.x_handle} was used by ${d.x_other.n} other coin${d.x_other.n === 1 ? "" : "s"} this fortnight.` });
  }

  if (d.buys5 + d.sells5 >= 10) {
    const grow = d.buyers5_before > 0 ? d.buyers5 / d.buyers5_before : null;
    lines.push({
      tone: d.buys5 >= d.sells5 ? "ok" : "warn",
      text: `Last 5 minutes: ${d.buys5} buys, ${d.sells5} sells, ${d.buyers5} buyers${grow != null ? ` (${grow >= 1 ? "up" : "down"} from ${d.buyers5_before})` : ""}.`,
    });
  }

  // the user's own filters
  if ((o.ageS ?? 1e9) < 1800 && (o.mcUsd ?? 0) < 20_000 && !o.social) lines.push({ tone: "warn", text: "Under 30 minutes, under $20K and no socials: your rules filter it out." });
  else if (o.mcUsd != null && o.mcUsd < 25_000) lines.push({ tone: "info", text: "Below your $25K minimum." });

  return { lines, fresh, cluster };
}
