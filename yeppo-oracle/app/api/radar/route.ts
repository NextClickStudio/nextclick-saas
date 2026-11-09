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
  /** yeppo's full read, for the coins the viewer's wallets just got into */
  verdict?: { word: string; why: string } | null;
  /** the user's rule, line by line: an early call only when every line passes and the read is Safe */
  checklist?: { label: string; ok: boolean; why: string }[];
  pass?: boolean;
};
export type Radar = { at: number; tracked: number; proven: number; coins: RadarCoin[]; sol: number };
export type BookWallet = { who: string; name?: string | null; emoji?: string | null; wins: number | null; tries: number | null; flips: number | null; creators: number | null; proven?: boolean; hit?: number; last: number | null; mine?: boolean };
export type Book = { mine: BookWallet[]; found: BookWallet[]; suggested?: BookWallet[] };

const rpc = async <T>(fn: string, body: Record<string, unknown>, ms = 6000): Promise<T> => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: DB_HEADERS, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${fn} ${r.status}`);
  return (await r.json()) as T;
};

// one answer per key for 5 s: the panel polls every 10 s, a second tab or device shares it
const cache = new Map<string, { t: number; v: Radar }>();

type ReadLite = {
  decision?: { word?: string; why?: string };
  checks?: { ok: boolean; label: string }[];
  money?: { kind: string | null; sol: number | null; rugs: number } | null;
  mcUsd?: number | null;
  venue?: string;
};

/** the full read of a coin through yeppo's own read route (2.5 s cache there): Safe, Risky, Danger or Too early */
async function readOf(origin: string, mint: string, key: string, dev: string | null): Promise<ReadLite | null> {
  try {
    const q = new URLSearchParams({ mint, key });
    if (dev) q.set("dev", dev);
    const r = await fetch(`${origin}/api/read?${q}`, { signal: AbortSignal.timeout(7000) });
    return (await r.json()) as ReadLite;
  } catch {
    return null;
  }
}

/** the user's rule: BUY only if ALL pass. 2+ of your wallets in within 15 minutes; funded by an exchange or a whale;
 *  no mint or freeze authority and no liquidity to pull; top 10 under 30%; at least $25K; and yeppo reads it Safe */
function checklistOf(c: RadarCoin, r: ReadLite | null) {
  const checks = r?.checks ?? [];
  const failed = (re: RegExp) => checks.some((k) => !k.ok && re.test(k.label));
  const top10 = Number(checks.find((k) => /top 10 hold/i.test(k.label))?.label.match(/(\d+)%/)?.[1] ?? NaN);
  const m = r?.money ?? null;
  const funded = m?.kind === "exchange" || c.flags.dev_cex ? "exchange" : m?.kind === "wallet" && (m.sol ?? 0) >= 10 ? "whale" : null;
  const lpBad = failed(/liquid|\blp\b|pool/i);
  const lines = [
    { label: "2+ of your wallets in within 15 min", ok: c.own >= 2 && c.out === 0, why: `${c.own} in, ${c.out} out` },
    {
      label: "Funded by an exchange or a whale",
      ok: !!funded && !(m?.rugs ?? 0),
      why:
        funded === "exchange"
          ? "creator paid from an exchange"
          : funded === "whale"
            ? `creator paid ${Math.round(m?.sol ?? 0)} SOL by one wallet`
            : m?.kind
              ? `creator paid by ${m.kind === "wallet" ? "a small wallet" : m.kind}`
              : "funding not read yet",
    },
    {
      label: "Mint and freeze revoked, liquidity safe",
      ok: !failed(/print/i) && !failed(/froz/i) && !lpBad,
      why: r?.venue === "pump.fun" ? "pump.fun: revoked by the launchpad, no pool to pull yet" : lpBad ? "liquidity can be pulled" : "revoked",
    },
    { label: "Top 10 holders under 30%", ok: Number.isFinite(top10) && top10 < 30, why: Number.isFinite(top10) ? `top 10 hold ${top10}%` : "not read yet" },
    { label: "At least $25K", ok: (r?.mcUsd ?? 0) >= 25_000, why: r?.mcUsd ? `$${Math.round(r.mcUsd / 1000)}K now` : "not read yet" },
    { label: "yeppo reads it Safe", ok: r?.decision?.word === "Safe", why: r?.decision?.word ?? "not read yet" },
  ];
  return { lines, pass: lines.every((l) => l.ok) };
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
    if (hit && Date.now() - hit.t < 4000) return Response.json(hit.v, { headers: { ...CORS, "cache-control": "private, no-store" } });
    const [r, sol] = await Promise.all([rpc<Omit<Radar, "sol">>("yr_radar_s", { p_key: key, p_dev: dev }), solPrice()]);
    // the full read, at once, for every coin one of the viewer's wallets just got into (newest first, signals first):
    // the analysis is there the moment a wallet enters, an early call still needs every line of the checklist
    const sig = [...r.coins]
      .filter((c) => c.own > 0)
      .sort((a, b) => Number(b.signal) - Number(a.signal) || b.last - a.last)
      .slice(0, 4);
    const reads = await Promise.all(sig.map((c) => readOf(u.origin, c.mint, key, dev)));
    sig.forEach((c, i) => {
      const rd = reads[i];
      c.verdict = rd?.decision?.word ? { word: rd.decision.word, why: rd.decision.why ?? "" } : null;
      const cl = checklistOf(c, rd);
      c.checklist = cl.lines;
      c.pass = cl.pass;
      // every Safe signal goes in the log once (wallets, checklist, reason), to measure the calls later
      if (c.verdict?.word === "Safe")
        void rpc("yr_radar_log_s", {
          p_key: key,
          p_dev: dev,
          p_mint: c.mint,
          p_mc: rd?.mcUsd ?? null,
          p_wallets: c.wallets.filter((w) => w.own).map((w) => ({ who: w.who, label: w.label, in: w.in })),
          p_checks: cl.lines,
          p_pass: cl.pass,
          p_reason: cl.pass ? "all checks pass" : `failed: ${cl.lines.filter((l) => !l.ok).map((l) => l.label).join(", ")}`,
        }).catch(() => undefined);
    });
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
