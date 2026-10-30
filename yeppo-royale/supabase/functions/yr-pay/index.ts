// yr-pay: checkout in SOL, straight to the owner's wallet (yr_config 'pay_wallet').
//  POST {action: "plans"}          the plans and whether checkout is open
//  POST {action: "order", plan}    a new order: a unique amount and a Solana Pay reference
//  POST {action: "check", id}      looks for the payment on-chain; once found, returns the license key
// A payment is matched by its Solana Pay reference, or by the order's exact amount reaching the wallet after
// the order was made. A payer who already has a running license gets it extended. Public Solana RPC only.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const RPCS = ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"];
const ORDER_TTL_MS = 24 * 3600_000;
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

type Plan = { id: string; name: string; days: number; sol: number };
type Tx = {
  blockTime: number | null;
  meta: { err: unknown; preBalances: number[]; postBalances: number[] } | null;
  transaction: { message: { accountKeys: ({ pubkey: string; signer: boolean } | string)[] } };
};

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
const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/.test(s);

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
        last = new Error(`${url} ${r.status}`);
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

/** lamports the wallet received in this transaction, and who signed it */
function received(tx: Tx | null, wallet: string): { got: number; payer: string | null } {
  if (!tx || !tx.meta || tx.meta.err) return { got: 0, payer: null };
  const keys = tx.transaction.message.accountKeys.map((k) => (typeof k === "string" ? { pubkey: k, signer: false } : k));
  const i = keys.findIndex((k) => k.pubkey === wallet);
  const payer = keys.find((k) => k.signer)?.pubkey ?? keys[0]?.pubkey ?? null;
  if (i < 0) return { got: 0, payer };
  return { got: tx.meta.postBalances[i] - tx.meta.preBalances[i], payer };
}

function newKey() {
  const b = crypto.getRandomValues(new Uint8Array(10));
  const s = [...b].map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `YEP-${s.slice(0, 5)}-${s.slice(5, 10)}-${s.slice(10, 15)}-${s.slice(15, 20)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { data: cfg } = await sb.from("yr_config").select("key,value").in("key", ["pay_wallet", "pay_plans"]);
  const wallet = cfg?.find((r) => r.key === "pay_wallet")?.value?.trim() ?? "";
  const plans = JSON.parse(cfg?.find((r) => r.key === "pay_plans")?.value ?? "[]") as Plan[];
  const open = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet);

  try {
    if (body.action === "plans") return json({ open, plans });

    if (body.action === "order") {
      if (!open) return json({ error: "Checkout opens at launch. yeppo is free until then." }, 409);
      const plan = plans.find((p) => p.id === body.plan);
      if (!plan) return json({ error: "Pick a plan" }, 400);
      const { count } = await sb
        .from("yr_orders")
        .select("id", { count: "exact", head: true })
        .is("paid_at", null)
        .gt("created_at", new Date(Date.now() - 600_000).toISOString());
      if ((count ?? 0) > 300) return json({ error: "Too many open orders right now, try again in a few minutes" }, 429);
      // a few extra lamports make the amount unique, so a plain transfer from any wallet can be matched too
      let lamports = 0;
      for (let tries = 0; tries < 6; tries++) {
        const extra = (1 + (crypto.getRandomValues(new Uint16Array(1))[0] % 999)) * 1000;
        const l = Math.round(plan.sol * 1e9) + extra;
        const { count: same } = await sb.from("yr_orders").select("id", { count: "exact", head: true }).eq("lamports", l).is("paid_at", null);
        if (!same) {
          lamports = l;
          break;
        }
      }
      if (!lamports) return json({ error: "Try again" }, 503);
      const ref = b58(crypto.getRandomValues(new Uint8Array(32)));
      const { data: o, error } = await sb.from("yr_orders").insert({ plan: plan.id, lamports, ref }).select("id").single();
      if (error) throw new Error(error.message);
      const sol = (lamports / 1e9).toFixed(6);
      const url = `solana:${wallet}?amount=${sol}&reference=${ref}&label=yeppo&message=${encodeURIComponent(`yeppo ${plan.name}`)}`;
      return json({ id: o.id, plan, sol, wallet, ref, url, expires: Date.now() + ORDER_TTL_MS });
    }

    if (body.action === "check") {
      if (!isUuid(body.id)) return json({ error: "Unknown order" }, 400);
      const { data: o } = await sb.from("yr_orders").select("*").eq("id", body.id).maybeSingle();
      if (!o) return json({ error: "Unknown order" }, 404);
      if (o.paid_at) {
        const { data: l } = await sb.from("yr_licenses").select("key,until,plan").eq("key", o.license).maybeSingle();
        return json({ paid: true, key: l?.key, until: l ? new Date(l.until).getTime() : null });
      }
      const created = new Date(o.created_at).getTime();
      if (Date.now() - created > ORDER_TTL_MS) return json({ paid: false, expired: true });
      if (!open) return json({ paid: false });

      // 1. Solana Pay: the wallet app put the reference in the transfer
      let found: { sig: string; payer: string | null } | null = null;
      const byRef = await rpc<{ signature: string; err: unknown }[]>("getSignaturesForAddress", [o.ref, { limit: 5, commitment: "confirmed" }]);
      for (const s of byRef.filter((x) => !x.err)) {
        const tx = await rpc<Tx | null>("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
        const r = received(tx, wallet);
        if (r.got >= o.lamports - 1000) {
          found = { sig: s.signature, payer: r.payer };
          break;
        }
      }
      // 2. a plain transfer of the exact amount to the wallet, after the order was made
      if (!found) {
        const recent = await rpc<{ signature: string; err: unknown; blockTime: number | null }[]>("getSignaturesForAddress", [
          wallet,
          { limit: 40, commitment: "confirmed" },
        ]);
        for (const s of recent.filter((x) => !x.err && (x.blockTime ?? 0) * 1000 >= created - 60_000).slice(0, 25)) {
          const { count: used } = await sb.from("yr_orders").select("id", { count: "exact", head: true }).eq("sig", s.signature);
          if (used) continue;
          const tx = await rpc<Tx | null>("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
          if (received(tx, wallet).got === o.lamports) {
            found = { sig: s.signature, payer: received(tx, wallet).payer };
            break;
          }
        }
      }
      if (!found) return json({ paid: false });

      const plan = plans.find((p) => p.id === o.plan) ?? { id: o.plan, name: "Pro", days: 30, sol: 0 };
      const days = plan.days * 86400_000;
      // the same payer with a running license gets it extended, so the key in their extension keeps working
      const { data: running } = found.payer
        ? await sb.from("yr_licenses").select("key,until").eq("payer", found.payer).gt("until", new Date().toISOString()).order("until", { ascending: false }).limit(1)
        : { data: null };
      let key: string;
      let until: number;
      if (running?.length) {
        key = running[0].key;
        until = new Date(running[0].until).getTime() + days;
        await sb.from("yr_licenses").update({ until: new Date(until).toISOString(), plan: plan.id }).eq("key", key);
      } else {
        key = newKey();
        until = Date.now() + days;
        const { error } = await sb.from("yr_licenses").insert({ key, plan: plan.id, until: new Date(until).toISOString(), payer: found.payer });
        if (error) throw new Error(error.message);
      }
      const { error: e2 } = await sb.from("yr_orders").update({ paid_at: new Date().toISOString(), sig: found.sig, payer: found.payer, license: key }).eq("id", o.id).is("paid_at", null);
      if (e2) throw new Error(e2.message);
      return json({ paid: true, key, until });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Something went wrong" }, 502);
  }
});
