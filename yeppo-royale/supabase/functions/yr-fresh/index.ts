// yr-fresh: how old the wallets holding a coin are. Called by yeppo.it's read (with the server's secret) with the top
// holders' addresses; it answers at once with what yeppo already knows (yr_wfresh, 24 h) and looks up the rest in the
// background on the public Solana node: up to 25 signatures per wallet, so it knows whether a wallet has made a handful
// of transactions in its whole life (a fresh or spam wallet) and when its oldest one was. The next read has them.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };
const RPC = "https://api.mainnet-beta.solana.com";
const ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

async function sigs(who: string): Promise<{ n: number; first: number | null } | null> {
  try {
    const r = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress", params: [who, { limit: 25 }] }),
      signal: AbortSignal.timeout(5000),
    });
    const j = (await r.json()) as { result?: { blockTime: number | null }[] };
    if (!Array.isArray(j.result)) return null;
    const times = j.result.map((s) => s.blockTime).filter((t): t is number => typeof t === "number");
    return { n: j.result.length, first: times.length ? Math.min(...times) * 1000 : null };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: sec } = await sb.from("yr_config").select("value").eq("key", "api_secret").maybeSingle();
  if (!sec?.value || req.headers.get("x-yeppo-secret") !== sec.value) return new Response("forbidden", { status: 403 });
  const who = [...new Set((new URL(req.url).searchParams.get("who") ?? "").split(",").filter((w) => ADDR.test(w)))].slice(0, 20);
  if (!who.length) return Response.json({});
  const since = Date.now() - 86_400_000;
  const { data } = await sb.from("yr_wfresh").select("who,n,first_t,t").in("who", who);
  const known: Record<string, [number, number | null]> = {};
  for (const r of data ?? []) if (Number(r.t) > since) known[r.who as string] = [Number(r.n), r.first_t == null ? null : Number(r.first_t)];
  const missing = who.filter((w) => !known[w]);
  if (missing.length) {
    // the public node allows a few calls a second from one address: four at a time
    EdgeRuntime.waitUntil(
      (async () => {
        const rows: { who: string; n: number; first_t: number | null; t: number }[] = [];
        for (let i = 0; i < missing.length; i += 4) {
          const got = await Promise.all(missing.slice(i, i + 4).map(async (w) => [w, await sigs(w)] as const));
          for (const [w, s] of got) if (s) rows.push({ who: w, n: s.n, first_t: s.first, t: Date.now() });
        }
        if (rows.length) await sb.from("yr_wfresh").upsert(rows, { onConflict: "who" });
      })(),
    );
  }
  return Response.json(known);
});
