// Live Solana memecoin data, straight from the browser (both APIs allow CORS).
// The fill math mirrors the `arena` edge function so previews match real fills.

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const FEE = 0.01;
export const MIN_LIQ_USD = 5000;
export const MAX_BUY_SOL = 5;
export const MAX_IMPACT = 0.2;
const PUMP_K = 32.19;
const DS = "https://api.dexscreener.com";
const GT = "https://api.geckoterminal.com/api/v2";

export type Coin = {
  mint: string;
  pair: string;
  dexId: string;
  symbol: string;
  name: string;
  image: string | null;
  priceUsd: number;
  priceSol: number;
  mcapUsd: number;
  liqUsd: number | null;
  reserveSol: number;
  vol24: number;
  vol5m: number;
  chg5m: number;
  chg1h: number;
  chg24h: number;
  buys5m: number;
  sells5m: number;
  createdAt: number | null;
  twitter: string | null;
  website: string | null;
  url: string;
  supply: number;
  at: number;
};

export type Launch = { mint: string; name: string; symbol: string; mcapSol: number; t: number };

export type Candle = { time: number; open: number; high: number; low: number; close: number };

type Pair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; symbol?: string };
  priceNative?: string;
  priceUsd?: string;
  txns?: { m5?: { buys?: number; sells?: number } };
  volume?: { h24?: number; m5?: number };
  priceChange?: { m5?: number; h1?: number; h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string; websites?: { url: string }[]; socials?: { type: string; url: string }[] };
};

let solUsd = 0;
export const getSolUsd = () => solUsd;

export const isMint = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s.trim());

const pairScore = (p: Pair) => (p.liquidity?.usd != null ? 1e12 + p.liquidity.usd : +(p.volume?.h24 ?? 0));

function updateSol(pairs: Pair[]) {
  let best = -1;
  for (const p of pairs) {
    if (p.baseToken?.address !== SOL_MINT || !/^USD/.test(p.quoteToken?.symbol ?? "")) continue;
    const liq = p.liquidity?.usd ?? 0;
    if (liq > best && +(p.priceUsd ?? 0) > 0) {
      best = liq;
      solUsd = +(p.priceUsd ?? 0);
    }
  }
}

function toCoin(p: Pair): Coin | null {
  const priceUsd = +(p.priceUsd ?? 0);
  if (!p.baseToken || !(priceUsd > 0) || !(solUsd > 0)) return null;
  const priceSol = p.quoteToken?.address === SOL_MINT && +(p.priceNative ?? 0) > 0 ? +(p.priceNative ?? 0) : priceUsd / solUsd;
  const mcapUsd = +(p.marketCap ?? p.fdv ?? 0);
  const liqUsd = p.liquidity?.usd != null ? +p.liquidity.usd : null;
  const reserveSol = liqUsd != null ? liqUsd / 2 / solUsd : Math.sqrt(Math.max(mcapUsd / solUsd, 1) * PUMP_K);
  return {
    mint: p.baseToken.address,
    pair: p.pairAddress ?? "",
    dexId: p.dexId ?? "",
    symbol: p.baseToken.symbol ?? "???",
    name: p.baseToken.name ?? "",
    image: p.info?.imageUrl ?? null,
    priceUsd,
    priceSol,
    mcapUsd,
    liqUsd,
    reserveSol,
    vol24: p.volume?.h24 ?? 0,
    vol5m: p.volume?.m5 ?? 0,
    chg5m: p.priceChange?.m5 ?? 0,
    chg1h: p.priceChange?.h1 ?? 0,
    chg24h: p.priceChange?.h24 ?? 0,
    buys5m: p.txns?.m5?.buys ?? 0,
    sells5m: p.txns?.m5?.sells ?? 0,
    createdAt: p.pairCreatedAt ?? null,
    twitter: p.info?.socials?.find((s) => s.type === "twitter")?.url ?? null,
    website: p.info?.websites?.[0]?.url ?? null,
    url: p.url ?? `https://dexscreener.com/solana/${p.baseToken.address}`,
    supply: mcapUsd > 0 ? mcapUsd / priceUsd : 0,
    at: Date.now(),
  };
}

function bestCoins(pairs: Pair[], wanted?: Set<string>) {
  const best = new Map<string, Pair>();
  for (const p of pairs) {
    const mint = p.baseToken?.address;
    if (!mint || mint === SOL_MINT || (p.chainId && p.chainId !== "solana")) continue;
    if (wanted && !wanted.has(mint)) continue;
    const cur = best.get(mint);
    if (!cur || pairScore(p) > pairScore(cur)) best.set(mint, p);
  }
  const out: Record<string, Coin> = {};
  for (const [mint, p] of best) {
    const c = toCoin(p);
    if (c) out[mint] = c;
  }
  return out;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Quotes for up to any number of mints (batched 29 + SOL per request). */
export async function fetchCoins(mints: string[]): Promise<Record<string, Coin>> {
  const wanted = [...new Set(mints.filter((m) => m && m !== SOL_MINT))];
  const chunks: string[][] = [];
  for (let i = 0; i < wanted.length; i += 29) chunks.push(wanted.slice(i, i + 29));
  if (!chunks.length) chunks.push([]);
  const results = await Promise.all(
    chunks.map((c) => getJson<Pair[]>(`${DS}/tokens/v1/solana/${[SOL_MINT, ...c].join(",")}`).catch(() => [] as Pair[])),
  );
  const pairs = results.flat();
  updateSol(pairs);
  return bestCoins(pairs, new Set(wanted));
}

type Listed = { chainId: string; tokenAddress: string };

const listMints = (d: Listed[]) => [...new Set(d.filter((x) => x.chainId === "solana").map((x) => x.tokenAddress))];

export async function fetchHotMints(): Promise<string[]> {
  const [top, latest] = await Promise.all([
    getJson<Listed[]>(`${DS}/token-boosts/top/v1`).catch(() => []),
    getJson<Listed[]>(`${DS}/token-boosts/latest/v1`).catch(() => []),
  ]);
  return listMints([...top, ...latest]).slice(0, 45);
}

export async function fetchFreshMints(): Promise<string[]> {
  return listMints(await getJson<Listed[]>(`${DS}/token-profiles/latest/v1`).catch(() => [])).slice(0, 30);
}

export async function searchCoins(q: string): Promise<Coin[]> {
  const query = q.trim();
  if (!query) return [];
  if (isMint(query)) {
    const res = await fetchCoins([query]);
    return Object.values(res);
  }
  if (!(solUsd > 0)) await fetchCoins([]);
  const d = await getJson<{ pairs: Pair[] }>(`${DS}/latest/dex/search?q=${encodeURIComponent(query)}`).catch(() => ({ pairs: [] }));
  return Object.values(bestCoins(d.pairs ?? [])).sort((a, b) => b.mcapUsd - a.mcapUsd);
}

/** USD candles from GeckoTerminal (free tier: 1m/5m/15m). */
export async function fetchCandles(pair: string, aggregate: number): Promise<Candle[]> {
  if (!pair) return [];
  try {
    const d = await getJson<{ data?: { attributes?: { ohlcv_list?: number[][] } } }>(
      `${GT}/networks/solana/pools/${pair}/ohlcv/minute?aggregate=${aggregate}&limit=300&currency=usd&token=base`,
    );
    return (d.data?.attributes?.ohlcv_list ?? [])
      .map(([time, open, high, low, close]) => ({ time, open, high, low, close }))
      .filter((c) => c.close > 0)
      .reverse();
  } catch {
    return [];
  }
}

/** Real-time pump.fun launches (PumpPortal free stream). Returns a disconnect fn. */
export function connectLaunches(onLaunch: (l: Launch) => void): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let retry = 1500;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const open = () => {
    try {
      ws = new WebSocket("wss://pumpportal.fun/api/data");
    } catch {
      return;
    }
    ws.onopen = () => {
      retry = 1500;
      ws?.send(JSON.stringify({ method: "subscribeNewToken" }));
    };
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(String(e.data));
        if (m.txType === "create" && m.mint) {
          onLaunch({ mint: m.mint, name: m.name ?? "", symbol: m.symbol ?? "???", mcapSol: +m.marketCapSol || 0, t: Date.now() });
        }
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => {
      if (closed) return;
      timer = setTimeout(open, retry);
      retry = Math.min(retry * 2, 30000);
    };
    ws.onerror = () => ws?.close();
  };
  open();
  return () => {
    closed = true;
    clearTimeout(timer);
    ws?.close();
  };
}

// --- fill math (identical to the edge function) ---

export function buyTokens(c: Coin, solIn: number) {
  const x = solIn * (1 - FEE);
  return x / (c.priceSol * (1 + x / c.reserveSol));
}

export function sellValue(c: Coin, tokens: number) {
  const y = tokens * c.priceSol;
  return (y / (1 + y / c.reserveSol)) * (1 - FEE);
}

export const maxBuy = (c: Coin) => Math.min(MAX_BUY_SOL, MAX_IMPACT * c.reserveSol);
export const buyImpact = (c: Coin, solIn: number) => (solIn * (1 - FEE)) / c.reserveSol;
export const tradeBlocked = (c: Coin) => c.liqUsd != null && c.liqUsd < MIN_LIQ_USD;
