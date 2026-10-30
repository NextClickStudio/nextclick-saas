// Coin pictures and socials from the coin's metadata json (IPFS), and the SOL price, both free.

export type CoinJson = { image: string | null; twitter: string | null; telegram: string | null; website: string | null; description: string | null };
const jsonCache = new Map<string, CoinJson | null>();
const jsonWait = new Map<string, Promise<CoinJson | null>>();
let jsonActive = 0;
const jsonQueue: (() => void)[] = [];

const gateway = (u: string) => {
  const cid = u.split("/ipfs/")[1];
  return cid ? `https://pump.mypinata.cloud/ipfs/${cid}` : u;
};
const link = (v: unknown, kind: "x" | "tg" | "web") => {
  if (typeof v !== "string" || !v.trim()) return null;
  let u = v.trim();
  if (kind === "x" && /^@?[A-Za-z0-9_]{1,15}$/.test(u)) u = `https://x.com/${u.replace(/^@/, "")}`;
  if (kind === "tg" && /^@?[A-Za-z0-9_]{4,32}$/.test(u)) u = `https://t.me/${u.replace(/^@/, "")}`;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
};

/** a coin's metadata json (cached, at most four lookups at a time) */
export function coinJson(uri: string | null | undefined): Promise<CoinJson | null> {
  if (!uri) return Promise.resolve(null);
  if (jsonCache.has(uri)) return Promise.resolve(jsonCache.get(uri)!);
  const busy = jsonWait.get(uri);
  if (busy) return busy;
  const p = new Promise<CoinJson | null>((resolve) => {
    const run = async () => {
      jsonActive++;
      let out: CoinJson | null = null;
      try {
        const r = await fetch(gateway(uri), { signal: AbortSignal.timeout(6000) });
        const j = (await r.json()) as Record<string, unknown>;
        const ext = (j.extensions ?? {}) as Record<string, unknown>;
        out = {
          image: typeof j.image === "string" && j.image ? gateway(j.image) : null,
          twitter: link(j.twitter ?? ext.twitter, "x"),
          telegram: link(j.telegram ?? ext.telegram, "tg"),
          website: link(j.website ?? ext.website, "web"),
          description: typeof j.description === "string" ? j.description.slice(0, 300) : null,
        };
      } catch {
        out = null;
      }
      jsonCache.set(uri, out);
      jsonActive--;
      jsonQueue.shift()?.();
      resolve(out);
    };
    if (jsonActive < 4) void run();
    else jsonQueue.push(() => void run());
  });
  jsonWait.set(uri, p);
  return p;
}

let solUsd = 0;
let solAt = 0;
let solWait: Promise<number> | null = null;
export const solPriceNow = () => solUsd;
/** SOL in USD from Binance's public market data, refreshed at most once a minute */
export function solPrice(): Promise<number> {
  if (solUsd && Date.now() - solAt < 60_000) return Promise.resolve(solUsd);
  if (solWait) return solWait;
  solWait = (async () => {
    try {
      const r = await fetch("https://data-api.binance.vision/api/v3/ticker/price?symbol=SOLUSDT", { signal: AbortSignal.timeout(5000) });
      const p = Number(((await r.json()) as { price?: string }).price);
      if (p > 0) {
        solUsd = p;
        solAt = Date.now();
      }
    } catch {
      /* keep the last price */
    }
    solWait = null;
    return solUsd;
  })();
  return solWait;
}
