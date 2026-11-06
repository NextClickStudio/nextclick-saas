// The coins with a word in their name or ticker, last 2 hours (yr_wave_s), with live numbers: shared by the scanner's
// wave drop-down (/api/wave) and the coin read's namesakes (/api/read). Kept per word on each server.
import { DB_HEADERS } from "./access";
import { SUPABASE_URL } from "./config";
import { solPrice } from "./meta";

export type WaveCoin = {
  mint: string; sym: string | null; name: string | null; t0: number; n: number; last: number;
  /** market cap and its high, in SOL; nowx / hix against the launch */
  mc: number; ath: number; nowx: number; hix: number;
  /** last 2 minutes on the curve: buys, sells, buying wallets, price change */
  b2: number; s2: number; w2: number; ch2: number | null;
  bun: number; out: number | null; grad: boolean;
  /** 2: the ticker is the word, 1: the name is the word, 0: the word is in the name */
  match: number;
  /** the first coin with that exact ticker */
  orig: boolean;
  /** no trade for 10 minutes and never past ×1.3 */
  dead: boolean;
  /** share snipers (first 15 s) still hold, coins under 20 minutes */
  sn: number | null;
  flag: "rug" | "bundle" | "snipers" | "devbag" | "dumped" | "farm" | "creator" | null;
  /** filled here: market cap in USD, and DexScreener's last 5 minutes for coins off the curve */
  mcUsd: number | null; dex: { b5: number; s5: number; ch5: number | null } | null;
};

const cache = new Map<string, { t: number; v: WaveCoin[] }>();
type Pair = { baseToken?: { address?: string }; liquidity?: { usd?: number }; txns?: { m5?: { buys: number; sells: number } }; priceChange?: { m5?: number }; marketCap?: number };

export async function wave(theme: string, keepMs = 10_000): Promise<WaveCoin[] | null> {
  const hit = cache.get(theme);
  if (hit && Date.now() - hit.t < keepMs) return hit.v;
  try {
    const [r, sol] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_wave_s`, { method: "POST", headers: DB_HEADERS, body: JSON.stringify({ p_theme: theme }), signal: AbortSignal.timeout(8000) }),
      solPrice(),
    ]);
    if (!r.ok) throw new Error(`${r.status}`);
    const coins: WaveCoin[] = ((await r.json()) as WaveCoin[]).map((c) => ({ ...c, mcUsd: sol && c.mc > 0 ? c.mc * sol : null, dex: null }));
    const moved = coins.filter((c) => c.grad).map((c) => c.mint).slice(0, 30);
    if (moved.length) {
      try {
        const d = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${moved.join(",")}`, { signal: AbortSignal.timeout(3500) });
        const pairs = (await d.json()) as Pair[];
        for (const c of coins) {
          if (!c.grad) continue;
          const p = (Array.isArray(pairs) ? pairs : []).filter((x) => x.baseToken?.address === c.mint).sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
          if (!p) continue;
          if (p.marketCap) c.mcUsd = p.marketCap;
          if (p.txns?.m5) c.dex = { b5: p.txns.m5.buys, s5: p.txns.m5.sells, ch5: p.priceChange?.m5 ?? null };
        }
      } catch {
        /* DexScreener did not answer: yeppo's last numbers stand */
      }
    }
    // alive first, then live, then exact name or ticker, then market cap
    coins.sort((a, b) => Number(a.dead) - Number(b.dead) || Number(isLive(b)) - Number(isLive(a)) || b.match - a.match || (b.mcUsd ?? 0) - (a.mcUsd ?? 0));
    cache.set(theme, { t: Date.now(), v: coins });
    if (cache.size > 60) cache.delete(cache.keys().next().value as string);
    return coins;
  } catch {
    return hit?.v ?? null;
  }
}

/** when the word's list was last fetched on this server */
export const waveAt = (theme: string) => cache.get(theme)?.t ?? Date.now();

export const isLive = (c: WaveCoin) => (c.dex ? c.dex.b5 + c.dex.s5 > 0 : Date.now() - c.last < 300_000);

