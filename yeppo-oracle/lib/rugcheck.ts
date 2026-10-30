// RugCheck's free public report (api.rugcheck.xyz): the holders, the creator, the linked "insider" wallets, the
// mint and freeze authorities and the locked liquidity of any Solana coin, wherever it trades. It lets yeppo run
// its scam checks on coins it did not see from their first trade: graduated to PumpSwap, or launched elsewhere.
import type { Check } from "./oracle";

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
          ? "No linked insider wallets"
          : r.insiders < 0.15
            ? `${r.insiderWallets} linked wallets hold ${p(r.insiders)}`
            : `${r.insiderWallets} linked wallets hold ${p(r.insiders)}: one team that can sell together`,
    },
  ];
  if (r.rugged) out.push({ ok: false, label: "RugCheck marks this coin as rugged" });
  for (const d of r.danger) out.push({ ok: false, label: `RugCheck warning: ${d}` });
  return out;
}

/** the full scam checks, for any coin */
export function rugChecks(r: Rug): Check[] {
  const lockOk = r.curve || (r.locked ?? 0) >= 0.9;
  return [
    { ok: r.top10 < 0.25, label: r.top10 < 0.25 ? `Top 10 wallets hold ${p(r.top10)}: spread out` : `Top 10 wallets hold ${p(r.top10)}: a few can crash it` },
    { ok: r.creator < 0.05, label: r.creator < 0.05 ? `Creator holds ${p(r.creator)}` : `Creator still holds ${p(r.creator)}: can dump on you` },
    ...extraChecks(r).slice(0, 1),
    { ok: !r.mintAuth, label: r.mintAuth ? "The creator can still print more coins" : "Nobody can print more coins" },
    { ok: !r.freezeAuth, label: r.freezeAuth ? "The creator can freeze your coins: you may not be able to sell" : "Nobody can freeze your coins" },
    {
      ok: lockOk,
      label: r.curve
        ? "On pump.fun's curve: the liquidity can't be pulled"
        : lockOk
          ? `Liquidity ${p(r.locked ?? 0)} locked or burned: it can't be pulled`
          : `Only ${p(r.locked ?? 0)} of the liquidity is locked: it can be pulled`,
    },
    ...extraChecks(r).slice(1),
  ];
}
