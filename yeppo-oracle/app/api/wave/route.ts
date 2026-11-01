// yeppo.it/api/wave?theme=…: every pump.fun coin of the last 2 hours with a wave's word in its name or ticker, with its
// live numbers and yeppo's quick flag, for the scanner's drop-down. Needs a Pro key. Read only when someone opens a
// wave, kept 20 s per wave and shared by everyone. Coins that left pump.fun's curve take their market cap and last
// 5 minutes from DexScreener (one call per wave).
import { accessOf, DB_HEADERS, LOCKED } from "@/lib/access";
import { SUPABASE_URL } from "@/lib/config";
import { solPrice } from "@/lib/meta";

export const runtime = "edge";

const CORS = { "access-control-allow-origin": "*" };

export type WaveCoin = {
  mint: string; sym: string | null; name: string | null; t0: number; n: number; last: number;
  /** market cap and its high, in SOL; nowx / hix against the launch */
  mc: number; ath: number; nowx: number; hix: number;
  /** last 2 minutes on the curve: buys, sells, buying wallets, price change */
  b2: number; s2: number; w2: number; ch2: number | null;
  bun: number; out: number | null; grad: boolean;
  flag: "rug" | "bundle" | "devbag" | "dumped" | "farm" | "creator" | null;
  /** filled here: market cap in USD, and DexScreener's last 5 minutes for coins off the curve */
  mcUsd: number | null; dex: { b5: number; s5: number; ch5: number | null } | null;
};

const cache = new Map<string, { t: number; v: WaveCoin[] }>();
type Pair = { baseToken?: { address?: string }; liquidity?: { usd?: number }; txns?: { m5?: { buys: number; sells: number } }; priceChange?: { m5?: number }; marketCap?: number };

async function wave(theme: string): Promise<WaveCoin[] | null> {
  const hit = cache.get(theme);
  if (hit && Date.now() - hit.t < 20_000) return hit.v;
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
    // graduated coins that are still trading first among the live ones, by market cap
    coins.sort((a, b) => Number(isLive(b)) - Number(isLive(a)) || (b.mcUsd ?? 0) - (a.mcUsd ?? 0));
    cache.set(theme, { t: Date.now(), v: coins });
    if (cache.size > 60) cache.delete(cache.keys().next().value as string);
    return coins;
  } catch {
    return hit?.v ?? null;
  }
}

const isLive = (c: WaveCoin) => (c.dex ? c.dex.b5 + c.dex.s5 > 0 : Date.now() - c.last < 300_000);

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const theme = (q.get("theme") ?? "").toLowerCase();
  if (!/^[a-z0-9]{3,20}$/.test(theme)) return Response.json({ error: "bad wave" }, { status: 400, headers: CORS });
  const acc = await accessOf((q.get("key") ?? "").trim().toUpperCase() || null, q.get("dev"));
  if (!acc.pro)
    return Response.json({ locked: true, why: LOCKED[acc.reason ?? "nokey"] ?? LOCKED.nokey }, { headers: { ...CORS, "cache-control": "private, no-store" } });
  const v = await wave(theme);
  if (!v) return Response.json({ error: "yeppo is busy, retrying" }, { status: 503, headers: { ...CORS, "cache-control": "no-store" } });
  return Response.json({ theme, at: cache.get(theme)?.t ?? Date.now(), coins: v }, { headers: { ...CORS, "cache-control": "public, s-maxage=15" } });
}
