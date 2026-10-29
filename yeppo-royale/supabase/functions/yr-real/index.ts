// yr-real: the on-chain side of real duels.
//  POST {action: "verify", secret, address, signature, message?}  (public)  checks a wallet signature and links the wallet
//       (message: a Sign In With Solana message the wallet built around our nonce, base64)
//  POST {} with x-ingest-key                             (pg_cron) polls the duelists' wallets for pump.fun trades
// Trades are read from the public Solana RPC: the pump.fun program logs a TradeEvent for every buy
// and sell, whatever app sent it. Only trades inside the duel window are stored.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

const RPCS = ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"];
const TRADE_DISC = [189, 219, 127, 211, 78, 230, 97, 238];
const RUN_MS = 50_000;
const POLL_MS = 4_000;
const MARK_MS = 8_000;
// sites a Sign In With Solana message may name (the wallet fills in the site the player is on)
const SIWS_DOMAINS = ["yeppo.it", "www.yeppo.it"];

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- base58 / base64 ----------
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58encode(bytes: Uint8Array): string {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "";
  for (const byte of bytes) {
    if (byte !== 0) break;
    out += "1";
  }
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
}
function b58decode(s: string): Uint8Array {
  const bytes = [0];
  for (const ch of s) {
    const v = B58.indexOf(ch);
    if (v < 0) throw new Error("bad base58");
    let carry = v;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const ch of s) {
    if (ch !== "1") break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- RPC ----------
let rpcTurn = 0;
async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  let last: unknown = null;
  for (let attempt = 0; attempt < RPCS.length * 2; attempt++) {
    const url = RPCS[(rpcTurn + attempt) % RPCS.length];
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8000),
      });
      if (r.status === 429 || r.status >= 500) {
        last = new Error(`${url} ${r.status}`);
        await sleep(250 * (attempt + 1));
        continue;
      }
      const j = await r.json();
      if (j.error) throw new Error(j.error.message ?? "rpc error");
      rpcTurn = (rpcTurn + 1) % RPCS.length;
      return j.result as T;
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("rpc failed");
}

type Trade = { mint: string; k: 1 | 2; sol: number; tok: number; user: string; vsol: number; vtok: number; ts: number };

function u64(b: Uint8Array, o: number) {
  return Number(new DataView(b.buffer, b.byteOffset + o, 8).getBigUint64(0, true));
}

/** every pump.fun TradeEvent in a transaction's logs */
function decodeTrades(logs: string[] | null | undefined): Trade[] {
  const out: Trade[] = [];
  for (const line of logs ?? []) {
    if (!line.startsWith("Program data: vdt/007mYe")) continue;
    let b: Uint8Array;
    try {
      b = b64decode(line.slice(14));
    } catch {
      continue;
    }
    if (b.length < 113 || TRADE_DISC.some((x, i) => b[i] !== x)) continue;
    out.push({
      mint: b58encode(b.slice(8, 40)),
      sol: u64(b, 40) / 1e9,
      tok: u64(b, 48) / 1e6,
      k: b[56] === 1 ? 1 : 2,
      user: b58encode(b.slice(57, 89)),
      ts: u64(b, 89),
      vsol: u64(b, 97) / 1e9,
      vtok: u64(b, 105) / 1e6,
    });
  }
  return out;
}

type Tx = { blockTime: number | null; meta: { err: unknown; logMessages: string[] | null } | null };
const getTx = (sig: string) => rpc<Tx | null>("getTransaction", [sig, { encoding: "json", maxSupportedTransactionVersion: 1, commitment: "confirmed" }]);

// ---------- verify ----------
async function ed25519Verify(msg: Uint8Array, sig: Uint8Array, pk: Uint8Array): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("raw", new Uint8Array(pk), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, new Uint8Array(sig), new Uint8Array(msg));
  } catch {
    // older runtimes without Ed25519 in WebCrypto
    const spec = "npm:tweetnacl@1.0.3";
    const nacl = (await import(spec)).default as { sign: { detached: { verify(m: Uint8Array, s: Uint8Array, k: Uint8Array): boolean } } };
    return nacl.sign.detached.verify(msg, sig, pk);
  }
}

async function verify(sb: SupabaseClient<any, any, any>, body: Record<string, string>) {
  const { secret, address, signature } = body;
  if (!secret || !address || !signature) return json({ error: "Missing fields" }, 400);
  const { data: chk, error } = await sb.rpc("yr_wallet_check", { p_secret: secret });
  if (error) return json({ error: error.message }, 400);
  let pk: Uint8Array;
  let sig: Uint8Array;
  try {
    pk = b58decode(address);
    sig = b64decode(signature);
  } catch {
    return json({ error: "Invalid wallet or signature" }, 400);
  }
  if (pk.length !== 32 || sig.length !== 64) return json({ error: "Invalid wallet or signature" }, 400);
  const expected = (chk as { message: string }).message;
  let signed: Uint8Array = new TextEncoder().encode(expected);
  if (body.message) {
    // Sign In With Solana: the wallet wrote the message, so check it is for yeppo, this wallet and this nonce
    try {
      signed = b64decode(body.message);
    } catch {
      return json({ error: "Invalid wallet or signature" }, 400);
    }
    const lines = new TextDecoder().decode(signed).split("\n");
    const domain = /^(\S+) wants you to sign in with your Solana account:$/.exec(lines[0] ?? "")?.[1];
    const nonce = /Nonce: ([A-Za-z0-9]+)$/.exec(expected)?.[1];
    if (!domain || !SIWS_DOMAINS.includes(domain) || lines[1] !== address || !nonce || !lines.includes(`Nonce: ${nonce}`)) {
      return json({ error: "This sign-in message is not for yeppo. Try again." }, 400);
    }
  }
  const ok = await ed25519Verify(signed, sig, pk);
  if (!ok) return json({ error: "The signature does not match this wallet" }, 400);
  const { error: le } = await sb.rpc("yr_wallet_link", { p_user: (chk as { user_id: string }).user_id, p_address: address });
  if (le) return json({ error: le.message }, 400);
  return json({ ok: true, wallet: address });
}

// ---------- poll ----------
type Job = { rduel: string; slot: number; wallet: string; last_sig: string | null; start: number; end: number };
type Sig = { signature: string; err: unknown; blockTime: number | null };

async function pollWallet(sb: SupabaseClient<any, any, any>, j: Job, marks: Map<string, { vsol: number; vtok: number; at: number }>, stats: Record<string, number>) {
  const opts: Record<string, unknown> = { limit: 60, commitment: "confirmed" };
  if (j.last_sig) opts.until = j.last_sig;
  const sigs = await rpc<Sig[]>("getSignaturesForAddress", [j.wallet, opts]);
  stats.sigs += sigs.length;
  const newest = sigs[0]?.signature ?? j.last_sig;
  const inWindow = sigs
    .filter((s) => !s.err && s.blockTime != null && s.blockTime * 1000 >= j.start - 2000 && s.blockTime * 1000 <= j.end + 2000)
    .reverse();
  const rows: Record<string, unknown>[] = [];
  let complete = true;
  for (const s of inWindow) {
    try {
      const tx = await getTx(s.signature);
      stats.txs++;
      if (!tx || tx.meta?.err) continue;
      const at = (tx.blockTime ?? s.blockTime ?? 0) * 1000;
      decodeTrades(tx.meta?.logMessages).forEach((t, ix) => {
        marks.set(t.mint, { vsol: t.vsol, vtok: t.vtok, at });
        if (t.user !== j.wallet || at < j.start || at > j.end) return;
        rows.push({ rduel: j.rduel, slot: j.slot, sig: s.signature, ix, mint: t.mint, k: t.k, sol: t.sol, tok: t.tok, vsol: t.vsol, vtok: t.vtok, at: new Date(at).toISOString() });
      });
    } catch {
      complete = false; // keep the cursor where it was and retry next round
      stats.errors++;
    }
  }
  if (rows.length) {
    const { error } = await sb.from("yr_rtrades").upsert(rows, { onConflict: "rduel,slot,sig,ix", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    stats.trades += rows.length;
  }
  await sb.from("yr_rcursor").upsert({ rduel: j.rduel, slot: j.slot, last_sig: complete ? newest : j.last_sig, polled_at: new Date().toISOString() });
  j.last_sig = complete ? newest : j.last_sig;
}

/** latest bonding-curve reserves of a coin, from its newest trade */
async function refreshMark(mint: string, marks: Map<string, { vsol: number; vtok: number; at: number }>) {
  const sigs = await rpc<Sig[]>("getSignaturesForAddress", [mint, { limit: 12, commitment: "confirmed" }]);
  for (const s of sigs.filter((x) => !x.err).slice(0, 4)) {
    const tx = await getTx(s.signature);
    const t = decodeTrades(tx?.meta?.logMessages).filter((x) => x.mint === mint).pop();
    if (t) {
      marks.set(mint, { vsol: t.vsol, vtok: t.vtok, at: (tx?.blockTime ?? 0) * 1000 });
      return;
    }
  }
}

async function poll(sb: SupabaseClient<any, any, any>) {
  const t0 = Date.now();
  const stats: Record<string, number> = { loops: 0, sigs: 0, txs: 0, trades: 0, marks: 0, errors: 0 };
  const marked = new Map<string, number>();
  while (Date.now() - t0 < RUN_MS) {
    const { data, error } = await sb.rpc("yr_rduel_jobs");
    if (error) return json({ error: error.message, stats }, 500);
    const jobs = (data as { wallets: Job[]; held: string[] }).wallets;
    const held = (data as { wallets: Job[]; held: string[] }).held;
    if (!jobs.length) break;
    stats.loops++;
    const marks = new Map<string, { vsol: number; vtok: number; at: number }>();
    for (const j of jobs) {
      try {
        await pollWallet(sb, j, marks, stats);
      } catch {
        stats.errors++;
      }
    }
    for (const mint of held) {
      if (marks.has(mint) || Date.now() - (marked.get(mint) ?? 0) < MARK_MS) continue;
      try {
        await refreshMark(mint, marks);
        marked.set(mint, Date.now());
      } catch {
        stats.errors++;
      }
    }
    if (marks.size) {
      const rows = [...marks].map(([mint, m]) => ({ mint, vsol: m.vsol, vtok: m.vtok, at: new Date(m.at || Date.now()).toISOString() }));
      await sb.from("yr_rmarks").upsert(rows);
      stats.marks += rows.length;
    }
    await sleep(POLL_MS);
  }
  return json({ ok: true, ms: Date.now() - t0, ...stats });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (body.action === "verify") return verify(sb, body);
  const { data: keyRow } = await sb.from("yr_config").select("value").eq("key", "ingest_key").maybeSingle();
  if (!keyRow || req.headers.get("x-ingest-key") !== keyRow.value) return json({ error: "forbidden" }, 403);
  return poll(sb);
});
