// yr-fund: where a wallet's first SOL came from. For a coin being read it traces the creator and the biggest
// buyers of the launch bundle; in the background (pg_cron) it traces creators who rugged. Each wallet is looked up
// once and kept in yr_fund. A funder that is an exchange (yr_exch), or a service busy with thousands of transfers a
// day, is marked 'exchange' and links nothing; a busy one joins yr_exch, so the list grows by itself. Public Solana
// RPC only; at most 5 wallets per call.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

// publicnode refuses history lookups without a token now: the Solana Foundation node goes first
const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];
const ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type" };

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  let last: unknown = null;
  for (const url of [...RPCS, ...RPCS]) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8000),
      });
      if (r.status === 429 || r.status >= 500) {
        last = new Error(`${r.status}`);
        continue;
      }
      const j = await r.json();
      if (j.error) throw new Error(j.error.message ?? "rpc error");
      return j.result as T;
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("rpc failed");
}

type Sig = { signature: string; blockTime: number | null; err: unknown };
type Ix = { program?: string; parsed?: { type?: string; info?: Record<string, unknown> } };
type PTx = { transaction: { message: { instructions: Ix[] } }; meta: { innerInstructions?: { instructions: Ix[] }[] } | null } | null;

/** the wallet that sent `addr` its first SOL */
async function firstFunder(addr: string): Promise<{ funder: string | null; kind: string; sol: number | null }> {
  let before: string | undefined;
  let oldest: string[] = [];
  let complete = false;
  for (let page = 0; page < 3; page++) {
    const sigs = await rpc<Sig[]>("getSignaturesForAddress", [addr, { limit: 1000, before, commitment: "confirmed" }]);
    if (!sigs.length) {
      complete = true;
      break;
    }
    oldest = sigs.slice(-4).map((s) => s.signature).reverse();
    if (sigs.length < 1000) {
      complete = true;
      break;
    }
    before = sigs[sigs.length - 1].signature;
  }
  if (!complete) return { funder: null, kind: "old", sol: null };
  let read = 0;
  for (const sig of oldest) {
    const tx = await rpc<PTx>("getTransaction", [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]).catch(() => null);
    if (!tx) continue;
    read++;
    const ixs = [...tx.transaction.message.instructions, ...(tx.meta?.innerInstructions ?? []).flatMap((x) => x.instructions)];
    for (const ix of ixs) {
      const info = ix.parsed?.info;
      if (ix.program !== "system" || !info) continue;
      const to = info.destination ?? info.newAccount;
      const from = info.source;
      if (to === addr && typeof from === "string" && from !== addr) {
        const lam = Number(info.lamports ?? 0);
        return { funder: from, kind: "wallet", sol: lam ? lam / 1e9 : null };
      }
    }
  }
  // the RPC answered none of them: try again later rather than remember "no funder"
  if (!read && oldest.length) throw new Error("rpc busy");
  return { funder: null, kind: "none", sol: null };
}

/** a service sending thousands of transfers a day */
async function isBusy(addr: string): Promise<boolean> {
  const sigs = await rpc<Sig[]>("getSignaturesForAddress", [addr, { limit: 1000, commitment: "confirmed" }]).catch(() => [] as Sig[]);
  const last = sigs[sigs.length - 1]?.blockTime;
  return sigs.length === 1000 && !!last && Date.now() / 1000 - last < 2 * 86400;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const body = (await req.json().catch(() => ({}))) as { devs?: unknown; dev?: unknown; mint?: unknown };
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const want: string[] = [];
  if (Array.isArray(body.devs)) for (const d of body.devs) if (typeof d === "string" && ADDR.test(d)) want.push(d);
  if (typeof body.dev === "string" && ADDR.test(body.dev)) want.push(body.dev);
  // the biggest holders of a coin's launch bundle
  if (typeof body.mint === "string" && ADDR.test(body.mint)) {
    const { data } = await sb.from("yr_bw").select("who").eq("mint", body.mint).gt("tok", 0).order("tok", { ascending: false }).limit(4);
    for (const r of data ?? []) want.push(r.who);
  }
  const uniq = [...new Set(want)].slice(0, 5);
  if (!uniq.length) return Response.json({ error: "no wallets" }, { status: 400, headers: CORS });
  const { data: known } = await sb.from("yr_fund").select("dev").in("dev", uniq);
  const todo = uniq.filter((d) => !(known ?? []).some((k) => k.dev === d));
  const rows: Record<string, unknown>[] = [];
  const busy = new Map<string, boolean>();
  const learned: { addr: string; auto: boolean }[] = [];
  for (const dev of todo) {
    try {
      const f = await firstFunder(dev);
      if (f.funder) {
        if (!busy.has(f.funder)) {
          const { data: ex } = await sb.from("yr_exch").select("addr").eq("addr", f.funder).maybeSingle();
          const b = !!ex || (await isBusy(f.funder));
          busy.set(f.funder, b);
          if (b && !ex) learned.push({ addr: f.funder, auto: true });
        }
        if (busy.get(f.funder)) f.kind = "exchange";
      }
      rows.push({ dev, funder: f.funder, kind: f.kind, sol: f.sol, t: Date.now() });
    } catch {
      /* the public RPC is busy: tried again on the next read */
    }
  }
  if (rows.length) await sb.from("yr_fund").upsert(rows);
  if (learned.length) await sb.from("yr_exch").upsert(learned, { ignoreDuplicates: true });
  return Response.json({ ok: true, traced: rows.length }, { headers: CORS });
});
