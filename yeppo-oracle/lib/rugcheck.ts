// RugCheck's free public report (api.rugcheck.xyz): the holders, the creator, the linked "insider" wallets, the
// mint and freeze authorities and the locked liquidity of any Solana coin, wherever it trades. It lets yeppo run
// its scam checks on coins it did not see from their first trade: graduated to PumpSwap, or launched elsewhere.
import type { Check } from "./decide";

type Holder = { address: string; owner: string; pct: number; insider?: boolean };
type Market = { marketType: string; pubkey: string; lp?: { lpLockedPct?: number; quoteUSD?: number; baseUSD?: number } };
type Report = {
  creator?: string | null;
  token?: { mintAuthority: string | null; freezeAuthority: string | null; supply: number };
  topHolders?: Holder[] | null;
  knownAccounts?: Record<string, { name: string; type: string }> | null;
  insiderNetworks?: { size: number; currentHolding: number }[] | null;
  markets?: Market[] | null;
  risks?: { name: string; level: string; description?: string }[] | null;
  totalHolders?: number;
  rugged?: boolean;
};

/** what yeppo keeps of a report, shares in 0..1 */
export type Rug = {
  dev: string | null;
  top10: number;
  creator: number;
  insiders: number;
  insiderWallets: number;
  mintAuth: boolean;
  freezeAuth: boolean;
  /** share of the deepest pool's liquidity that is locked or burned; null when there is no pool */
  locked: number | null;
  curve: boolean;
  holders: number | null;
  danger: string[];
  rugged: boolean;
};

const cache = new Map<string, { t: number; v: Rug }>();
const TTL = 20_000;

export async function rugReport(mint: string): Promise<Rug | null> {
  const hit = cache.get(mint);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  try {
    const r = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`, { signal: AbortSignal.timeout(3500) });
    if (!r.ok) return hit?.v ?? null;
    const v = digest((await r.json()) as Report);
    if (cache.size > 500) cache.clear();
    cache.set(mint, { t: Date.now(), v });
    return v;
  } catch {
    return hit?.v ?? null;
  }
}

// RugCheck's own warnings that the checks below already say in plain words
const COVERED = /mint authority|freeze authority|lp unlocked|liquidity unlocked|top 10|holder|creator/i;

function digest(j: Report): Rug {
  const known = j.knownAccounts ?? {};
  const markets = j.markets ?? [];
  const pools = new Set(markets.map((m) => m.pubkey));
  const isPool = (h: Holder) => {
    const k = known[h.owner]?.type ?? known[h.address]?.type;
    return k === "AMM" || k === "LOCKER" || pools.has(h.owner) || pools.has(h.address);
  };
  const people = (j.topHolders ?? []).filter((h) => !isPool(h));
  const top10 = people.slice(0, 10).reduce((a, h) => a + h.pct, 0) / 100;
  const creator = (j.topHolders ?? []).filter((h) => h.owner === j.creator).reduce((a, h) => a + h.pct, 0) / 100;
  const supply = j.token?.supply || 1;
  const nets = j.insiderNetworks ?? [];
  const deep = [...markets].sort((a, b) => (b.lp?.quoteUSD ?? 0) + (b.lp?.baseUSD ?? 0) - ((a.lp?.quoteUSD ?? 0) + (a.lp?.baseUSD ?? 0)))[0];
  return {
    dev: j.creator ?? null,
    top10,
    creator,
    insiders: nets.reduce((a, n) => a + (n.currentHolding || 0), 0) / supply,
    insiderWallets: nets.reduce((a, n) => a + (n.size || 0), 0),
    mintAuth: !!j.token?.mintAuthority,
    freezeAuth: !!j.token?.freezeAuthority,
    locked: deep?.lp?.lpLockedPct != null ? deep.lp.lpLockedPct / 100 : null,
    curve: deep?.marketType === "pump_fun",
    holders: j.totalHolders ?? null,
    danger: (j.risks ?? []).filter((r) => r.level === "danger" && !COVERED.test(r.name)).map((r) => r.name),
    rugged: !!j.rugged,
  };
}

const p = (x: number) => `${Math.round(Math.max(0, x) * 100)}%`;

/** the checks that only RugCheck can see on a coin yeppo followed: wallets linked to each other, and its warnings */
export function extraChecks(r: Rug): Check[] {
  const out: Check[] = [
    {
      ok: r.insiders < 0.15,
      label:
        r.insiderWallets === 0
          ? "No insider group"
          : r.insiders < 0.15
            ? `Insider group holds ${p(r.insiders)}`
            : `Insider group holds ${p(r.insiders)}. They sell together.`,
    },
  ];
  if (r.rugged) out.push({ ok: false, label: "Already rugged." });
  for (const d of r.danger) out.push({ ok: false, label: `${d}.` });
  return out;
}

/** the full safety checks, for any coin */
export function rugChecks(r: Rug): Check[] {
  const lockOk = r.curve || (r.locked ?? 0) >= 0.9;
  return [
    { ok: r.top10 < 0.25, label: r.top10 < 0.25 ? `Top 10 hold ${p(r.top10)}` : `Top 10 hold ${p(r.top10)}. They can crash it.` },
    { ok: r.creator < 0.05, label: r.creator < 0.05 ? `Creator holds ${p(r.creator)}` : `Creator still holds ${p(r.creator)}. Can dump on you.` },
    ...extraChecks(r).slice(0, 1),
    { ok: !r.mintAuth, label: r.mintAuth ? "Creator can print more coins." : "No new coins can be printed" },
    { ok: !r.freezeAuth, label: r.freezeAuth ? "Creator can freeze your coins." : "Your coins can't be frozen" },
    { ok: lockOk, label: lockOk ? "Liquidity can't be pulled" : "Liquidity can be pulled." },
    ...extraChecks(r).slice(1),
  ];
}

const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];
const SYSTEM = "11111111111111111111111111111111";
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const chainCache = new Map<string, { t: number; v: ChainRead }>();

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(bytes: Uint8Array) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

async function rpc<T>(method: string, params: unknown[], ms: number, nodes = RPCS): Promise<T | null> {
  for (const url of nodes) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(ms),
      });
      if (!r.ok) continue;
      const j = (await r.json()) as { result?: T; error?: unknown };
      if (j.error || j.result === undefined) continue;
      return j.result;
    } catch {
      /* next node */
    }
  }
  return null;
}

export type ChainRead = { checks: Check[]; holders: number | null };

/** when RugCheck does not answer, the same checks straight from the chain, through the free public Solana node:
 *  every holder of the coin (one account list), the top 10 people and the creator's share (pools and other
 *  program-owned accounts left out), and whether more coins can be printed or wallets frozen. */
export async function chainChecks(mint: string, dev: string | null): Promise<ChainRead | null> {
  const ck = `${mint}:${dev ?? ""}`;
  const hit = chainCache.get(ck);
  if (hit && Date.now() - hit.t < 60_000) return hit.v;
  type MintAcc = { owner: string; data: { parsed?: { info?: { mintAuthority?: string | null; freezeAuthority?: string | null; supply?: string } } } };
  const m = await rpc<{ value: MintAcc | null }>("getAccountInfo", [mint, { encoding: "jsonParsed" }], 2500);
  const info = m?.value?.data?.parsed?.info;
  if (!m?.value || !info) return hit?.v ?? null;
  const checks: Check[] = [];
  let holders: number | null = null;
  // every token account of this coin: just its owner and amount (bytes 32..72)
  const filters: unknown[] = [{ memcmp: { offset: 0, bytes: mint } }];
  if (m.value.owner === TOKEN) filters.push({ dataSize: 165 });
  const accs = await rpc<{ account: { data: [string, string] } }[]>(
    "getProgramAccounts",
    [m.value.owner, { encoding: "base64", dataSlice: { offset: 32, length: 40 }, filters }],
    4500,
    RPCS.slice(0, 1),
  );
  const supply = Number(info.supply ?? 0);
  if (accs && supply > 0) {
    const byOwner = new Map<string, number>();
    for (const a of accs) {
      const b = Uint8Array.from(atob(a.account.data[0]), (c) => c.charCodeAt(0));
      if (b.length < 40) continue;
      const amt = Number(new DataView(b.buffer).getBigUint64(32, true));
      if (amt <= 0) continue;
      const owner = b58(b.slice(0, 32));
      byOwner.set(owner, (byOwner.get(owner) ?? 0) + amt);
    }
    holders = byOwner.size;
    const top = [...byOwner].sort((a, b) => b[1] - a[1]).slice(0, 20);
    // pools, the bonding curve and lockers are accounts owned by a program, not wallets: leave them out
    const owners = await rpc<{ value: ({ owner: string } | null)[] }>(
      "getMultipleAccounts",
      [top.map((t) => t[0]), { encoding: "base64", dataSlice: { offset: 0, length: 0 } }],
      2500,
    );
    if (owners) {
      const people = top.filter((_, i) => {
        const o = owners.value[i];
        return !o || o.owner === SYSTEM;
      });
      const top10 = people.slice(0, 10).reduce((a, t) => a + t[1], 0) / supply;
      checks.push({ ok: top10 < 0.25, label: top10 < 0.25 ? `Top 10 hold ${p(top10)}` : `Top 10 hold ${p(top10)}. They can crash it.` });
      if (dev) {
        const c = (byOwner.get(dev) ?? 0) / supply;
        checks.push({ ok: c < 0.05, label: c < 0.05 ? `Creator holds ${p(c)}` : `Creator still holds ${p(c)}. Can dump on you.` });
      }
    }
  }
  checks.push(
    { ok: !info.mintAuthority, label: info.mintAuthority ? "Creator can print more coins." : "No new coins can be printed" },
    { ok: !info.freezeAuthority, label: info.freezeAuthority ? "Creator can freeze your coins." : "Your coins can't be frozen" },
  );
  const v = { checks, holders };
  if (chainCache.size > 500) chainCache.clear();
  chainCache.set(ck, { t: Date.now(), v });
  return v;
}
