// yeppo.it/api/radar: the viewer's own wallets (imported from Axiom) and the wallets yeppo proved on its own, and what
// they are buying on pump.fun in the last 15 minutes (yr_radar_s, from the trades yeppo already keeps). A coin is an
// early call only when 2+ of the viewer's wallets got in within 15 minutes, none of them sold, AND yeppo's full read
// of the coin says Safe: the radar's quick flags alone never make a call. Needs a Pro key.
//   GET  ?key&dev          live coins (every 10 s from the panel)
//   GET  ?key&dev&book=1   the viewer's wallets with their record, and wallets yeppo found (for the Axiom export)
//   POST {key, dev, list}  replaces the viewer's list (Axiom's export JSON as is, or plain addresses)
import { accessOf, DB_HEADERS, LOCKED } from "@/lib/access";
import { SUPABASE_URL } from "@/lib/config";
import { solPrice } from "@/lib/meta";

export const runtime = "edge";
// next to the database (eu-west-1), like the read
export const preferredRegion = "dub1";
const CORS = { "access-control-allow-origin": "*" };

export type RadarWallet = { who: string; label: string; emoji: string | null; own: boolean; wins: number | null; tries: number | null; in: number; out: number; at: number | null; sold: number | null };
export type RadarCoin = {
  mint: string; sym: string | null; name: string | null; t0: number | null; n: number | null;
  /** market cap now, its high, and when the first tracked wallet bought, in SOL */
  mc: number; ath: number; mc_in: number | null;
  own: number; proven: number; out: number; first: number; last: number; sol: number;
  /** 2+ of the viewer's wallets within 15 minutes and none out (the verdict is checked below) */
  signal: boolean;
  flags: { rug: boolean; bundle: number; dev_holds: number; dev_out_s: number | null; grad: boolean; dev_cex: boolean };
  wallets: RadarWallet[];
  /** yeppo's full read, for the signal coins only */
  verdict?: { word: string; why: string } | null;
};
export type Radar = { at: number; tracked: number; proven: number; coins: RadarCoin[]; sol: number };
export type BookWallet = { who: string; name?: string | null; emoji?: string | null; wins: number | null; tries: number | null; flips: number | null; creators: number | null; proven?: boolean; hit?: number; last: number | null };
export type Book = { mine: BookWallet[]; found: BookWallet[] };

const rpc = async <T>(fn: string, body: Record<string, unknown>, ms = 6000): Promise<T> => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: DB_HEADERS, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${fn} ${r.status}`);
  return (await r.json()) as T;
};

// one answer per key for 5 s: the panel polls every 10 s, a second tab or device shares it
const cache = new Map<string, { t: number; v: Radar }>();

/** the full read of a coin through yeppo's own read route (2.5 s cache there): Safe, Risky, Danger or Too early */
async function verdictOf(origin: string, mint: string, key: string, dev: string | null) {
  try {
    const q = new URLSearchParams({ mint, key });
    if (dev) q.set("dev", dev);
    const r = await fetch(`${origin}/api/read?${q}`, { signal: AbortSignal.timeout(7000) });
    const j = (await r.json()) as { decision?: { word?: string; why?: string } };
    return j.decision?.word ? { word: j.decision.word, why: j.decision.why ?? "" } : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const key = (u.searchParams.get("key") ?? "").trim().toUpperCase();
  const dev = u.searchParams.get("dev");
  const acc = await accessOf(key || null, dev);
  if (!acc.pro) return Response.json({ locked: true, why: LOCKED[acc.reason ?? "nokey"] ?? LOCKED.nokey }, { headers: { ...CORS, "cache-control": "no-store" } });
  try {
    if (u.searchParams.get("book")) {
      const b = await rpc<Book>("yr_radar_book_s", { p_key: key, p_dev: dev });
      return Response.json(b, { headers: { ...CORS, "cache-control": "private, no-store" } });
    }
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < 5000) return Response.json(hit.v, { headers: { ...CORS, "cache-control": "private, no-store" } });
    const [r, sol] = await Promise.all([rpc<Omit<Radar, "sol">>("yr_radar_s", { p_key: key, p_dev: dev }), solPrice()]);
    // the full read for the first three signal coins: an early call needs yeppo's Safe
    const sig = r.coins.filter((c) => c.signal).slice(0, 3);
    const reads = await Promise.all(sig.map((c) => verdictOf(u.origin, c.mint, key, dev)));
    sig.forEach((c, i) => (c.verdict = reads[i]));
    const v: Radar = { ...r, sol };
    if (cache.size > 500) cache.clear();
    cache.set(key, { t: Date.now(), v });
    return Response.json(v, { headers: { ...CORS, "cache-control": "private, no-store" } });
  } catch {
    const old = cache.get(key);
    if (old) return Response.json(old.v, { headers: { ...CORS, "cache-control": "no-store" } });
    return Response.json({ error: "yeppo is busy, retrying" }, { status: 503, headers: { ...CORS, "cache-control": "no-store" } });
  }
}

export async function POST(req: Request) {
  let body: { key?: string; dev?: string; list?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "That isn't JSON." }, { status: 400, headers: CORS });
  }
  const key = (body.key ?? "").trim().toUpperCase();
  const acc = await accessOf(key || null, body.dev ?? null);
  if (!acc.pro) return Response.json({ locked: true, why: LOCKED[acc.reason ?? "nokey"] ?? LOCKED.nokey }, { status: 403, headers: CORS });
  // Axiom's export (an array of objects) or plain addresses; a single object is taken as a list of one
  const list = Array.isArray(body.list) ? body.list : body.list && typeof body.list === "object" ? [body.list] : [];
  if (!list.length) return Response.json({ error: "No wallets found in what you pasted." }, { status: 400, headers: CORS });
  try {
    const r = await rpc<{ saved?: number; error?: string }>("yr_radar_set_s", { p_key: key, p_dev: body.dev ?? null, p_list: list.slice(0, 500) });
    cache.delete(key);
    return Response.json(r, { headers: { ...CORS, "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "yeppo is busy, try again in a minute." }, { status: 503, headers: CORS });
  }
}
