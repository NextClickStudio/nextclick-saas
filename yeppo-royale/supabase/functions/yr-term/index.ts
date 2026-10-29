// yr-term: the yeppo terminal's link to the chain.
//  POST {action: "trade", secret, duel, mint, sym, side, amount, expect, slip}  (public)  a live-duel fill, priced on the coin's
//       bonding curve as it is on-chain right now
//  POST {action: "settle", duel}   (public)   refreshes the marks of the duel's open bags and settles it once the clock ran out
//  POST {action: "coin", mint}     (public)   curve, name and latest trades of any pump.fun coin, read from the chain
//  POST {} with x-ingest-key       (pg_cron)  keeps the marks of open bags fresh and settles finished duels
// Everything comes from the public Solana RPC. No API keys.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { ed25519 } from "npm:@noble/curves@1.4.2/ed25519";

const RPCS = ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"];
const PUMP = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const METAPLEX = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
const TRADE_DISC = [189, 219, 127, 211, 78, 230, 97, 238];
const RUN_MS = 50_000;
const LOOP_MS = 3_000;
const HISTORY = 50;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });
const fail = (error: string, status = 400) => json({ error }, status);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// deno-lint-ignore no-explicit-any
type Sb = SupabaseClient<any, any, any>;

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
const u64 = (b: Uint8Array, o: number) => Number(new DataView(b.buffer, b.byteOffset + o, 8).getBigUint64(0, true));
const u32 = (b: Uint8Array, o: number) => new DataView(b.buffer, b.byteOffset + o, 4).getUint32(0, true);
const u16 = (b: Uint8Array, o: number) => new DataView(b.buffer, b.byteOffset + o, 2).getUint16(0, true);
const isMint = (s: unknown): s is string => typeof s === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/.test(s);

// ---------- program addresses ----------
function onCurve(b: Uint8Array) {
  try {
    ed25519.ExtendedPoint.fromHex(b);
    return true;
  } catch {
    return false;
  }
}

async function findPda(seeds: Uint8Array[], program: string): Promise<string> {
  const pid = b58decode(program);
  const tail = new TextEncoder().encode("ProgramDerivedAddress");
  for (let bump = 255; bump >= 0; bump--) {
    const parts = [...seeds, new Uint8Array([bump]), pid, tail];
    const buf = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) {
      buf.set(p, o);
      o += p.length;
    }
    const h = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
    if (!onCurve(h)) return b58encode(h);
  }
  throw new Error("no program address");
}

const pdaCache = new Map<string, string>();
async function curvePda(mint: string) {
  let p = pdaCache.get(mint);
  if (!p) {
    const m = b58decode(mint);
    if (m.length !== 32) throw new Error("Unknown coin");
    p = await findPda([new TextEncoder().encode("bonding-curve"), m], PUMP);
    if (pdaCache.size > 5000) pdaCache.clear();
    pdaCache.set(mint, p);
  }
  return p;
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
        signal: AbortSignal.timeout(6000),
      });
      if (r.status === 429 || r.status >= 500) {
        last = new Error(`${url} ${r.status}`);
        await sleep(150 * (attempt + 1));
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

type Acc = { data: [string, string]; owner: string } | null;
type Curve = { vtok: number; vsol: number; rtok: number; rsol: number; supply: number; complete: boolean; creator: string };

function parseCurve(acc: Acc): Curve | null {
  if (!acc || acc.owner !== PUMP) return null;
  const b = b64decode(acc.data[0]);
  if (b.length < 49) return null;
  return {
    vtok: u64(b, 8) / 1e6,
    vsol: u64(b, 16) / 1e9,
    rtok: u64(b, 24) / 1e6,
    rsol: u64(b, 32) / 1e9,
    supply: u64(b, 40) / 1e6,
    complete: b[48] === 1,
    creator: b.length >= 81 ? b58encode(b.slice(49, 81)) : "",
  };
}

async function readCurves(mints: string[], commitment = "confirmed") {
  const out = new Map<string, Curve>();
  for (let i = 0; i < mints.length; i += 100) {
    const chunk = mints.slice(i, i + 100);
    const pdas = await Promise.all(chunk.map(curvePda));
    const r = await rpc<{ value: Acc[] }>("getMultipleAccounts", [pdas, { encoding: "base64", commitment }]);
    r.value.forEach((a, j) => {
      const c = parseCurve(a);
      if (c) out.set(chunk[j], c);
    });
  }
  return out;
}

/** writes the latest price of every coin still on its curve; graduated coins keep their last price */
async function refreshMarks(sb: Sb, mints: string[]) {
  if (!mints.length) return 0;
  const curves = await readCurves(mints);
  const at = new Date().toISOString();
  const rows = [...curves].filter(([, c]) => !c.complete && c.vtok > 0 && c.vsol > 0).map(([mint, c]) => ({ mint, vsol: c.vsol, vtok: c.vtok, at }));
  if (rows.length) await sb.from("yr_rmarks").upsert(rows);
  return rows.length;
}

// ---------- coin metadata ----------
function borshStr(b: Uint8Array, o: number): [string, number] {
  const n = u32(b, o);
  const s = new TextDecoder().decode(b.slice(o + 4, o + 4 + n)).replace(/\0+$/g, "").trim();
  return [s, o + 4 + n];
}

/** Token-2022 mints carry their name in the metadata extension (TLV type 19) */
function token2022Meta(b: Uint8Array) {
  let o = 166;
  while (o + 4 <= b.length) {
    const type = u16(b, o);
    const len = u16(b, o + 2);
    if (type === 19) {
      // update authority and mint come first, then name, symbol and uri
      const [name, p1] = borshStr(b, o + 4 + 64);
      const [symbol, p2] = borshStr(b, p1);
      const [uri] = borshStr(b, p2);
      return { name, symbol, uri };
    }
    if (type === 0 && len === 0) break;
    o += 4 + len;
  }
  return null;
}

function metaplexMeta(b: Uint8Array) {
  if (b.length < 70) return null;
  const [name, p1] = borshStr(b, 65);
  const [symbol, p2] = borshStr(b, p1);
  const [uri] = borshStr(b, p2);
  return { name, symbol, uri };
}

type Tx = { blockTime: number | null; meta: { err: unknown; logMessages: string[] | null } | null };

function decodeTrades(logs: string[] | null | undefined, mint: string) {
  const out: [number, number, number, number, number, number, string][] = [];
  for (const line of logs ?? []) {
    if (!line.startsWith("Program data: vdt/007mYe")) continue;
    let b: Uint8Array;
    try {
      b = b64decode(line.slice(14));
    } catch {
      continue;
    }
    if (b.length < 113 || TRADE_DISC.some((x, i) => b[i] !== x)) continue;
    if (b58encode(b.slice(8, 40)) !== mint) continue;
    const user = b58encode(b.slice(57, 89));
    // [atMs, kind, sol, tokens, vSol, vTokens, wallet]
    out.push([u64(b, 89) * 1000, b[56] === 1 ? 1 : 2, u64(b, 40) / 1e9, u64(b, 48) / 1e6, u64(b, 97) / 1e9, u64(b, 105) / 1e6, `${user.slice(0, 4)}…${user.slice(-4)}`]);
  }
  return out;
}

async function coin(sb: Sb, mint: string) {
  const key = `coin:${mint}`;
  const { data: hit } = await sb.from("yr_tcache").select("at,data").eq("k", key).maybeSingle();
  if (hit && Date.now() - new Date(hit.at).getTime() < 15_000) return hit.data;

  const m = b58decode(mint);
  if (m.length !== 32) throw new Error("Unknown coin");
  const pda = await curvePda(mint);
  const mp = await findPda([new TextEncoder().encode("metadata"), b58decode(METAPLEX), m], METAPLEX);
  const accs = await rpc<{ value: Acc[] }>("getMultipleAccounts", [[mint, pda, mp], { encoding: "base64", commitment: "confirmed" }]);
  const [mintAcc, curveAcc, mpAcc] = accs.value;
  if (!mintAcc) throw new Error("This address is not a token");
  const curve = parseCurve(curveAcc);
  if (!curve) throw new Error("Not a pump.fun coin");
  let meta = mintAcc.owner === TOKEN_2022 ? token2022Meta(b64decode(mintAcc.data[0])) : null;
  if (!meta && mpAcc) meta = metaplexMeta(b64decode(mpAcc.data[0]));

  const sigs = await rpc<{ signature: string; err: unknown }[]>("getSignaturesForAddress", [pda, { limit: HISTORY, commitment: "confirmed" }]);
  const ok = sigs.filter((s) => !s.err);
  const trades: ReturnType<typeof decodeTrades> = [];
  for (let i = 0; i < ok.length; i += 6) {
    const txs = await Promise.all(
      ok.slice(i, i + 6).map((s) =>
        rpc<Tx | null>("getTransaction", [s.signature, { encoding: "json", maxSupportedTransactionVersion: 1, commitment: "confirmed" }]).catch(() => null),
      ),
    );
    for (const tx of txs) if (tx && !tx.meta?.err) trades.push(...decodeTrades(tx.meta?.logMessages, mint));
  }
  trades.sort((a, b) => a[0] - b[0]);
  const data = {
    mint,
    name: meta?.name ?? null,
    symbol: meta?.symbol ?? null,
    uri: meta?.uri ?? null,
    curve,
    trades,
    at: Date.now(),
  };
  await sb.from("yr_tcache").upsert({ k: key, at: new Date().toISOString(), data });
  return data;
}

// ---------- actions ----------
async function trade(sb: Sb, b: Record<string, unknown>) {
  const { secret, duel, mint, sym, side } = b;
  const amount = Number(b.amount);
  const expect = Number(b.expect) || 0;
  const slip = Math.min(Math.max(Number(b.slip) || 0, 0), 1);
  if (typeof secret !== "string" || !isUuid(duel) || !isMint(mint) || (side !== "buy" && side !== "sell") || !(amount > 0)) {
    return fail("Bad trade request");
  }
  const pda = await curvePda(mint);
  const r = await rpc<{ value: Acc }>("getAccountInfo", [pda, { encoding: "base64", commitment: "processed" }]);
  const c = parseCurve(r.value);
  if (!c) return fail("Not a pump.fun coin");
  if (c.complete || !(c.vtok > 0)) return fail("This coin graduated to PumpSwap. Duels count bonding-curve trades only.");
  const { data, error } = await sb.rpc("yr_lduel_fill", {
    p_secret: secret,
    p_duel: duel,
    p_mint: mint,
    p_sym: typeof sym === "string" ? sym : null,
    p_side: side,
    p_amount: amount,
    p_vsol: c.vsol,
    p_vtok: c.vtok,
    p_expect: expect,
    p_slip: slip,
  });
  if (error) return fail(error.message);
  return json({ ...(data as Record<string, unknown>), vsol: c.vsol, vtok: c.vtok, rsol: c.rsol });
}

async function settle(sb: Sb, duel: string | null) {
  const { data, error } = await sb.rpc("yr_lduel_jobs", { p_duel: duel });
  if (error) throw new Error(error.message);
  const jobs = data as { live: number; held: string[]; due: string[] };
  const marked = await refreshMarks(sb, jobs.held).catch(() => 0);
  for (const id of jobs.due) await sb.rpc("yr_lduel_settle", { p_duel: id, p_force: false });
  return { live: jobs.live, marked, settled: jobs.due.length };
}

async function cron(sb: Sb) {
  const t0 = Date.now();
  const stats = { loops: 0, marked: 0, settled: 0 };
  while (Date.now() - t0 < RUN_MS) {
    const s = await settle(sb, null);
    stats.loops++;
    stats.marked += s.marked;
    stats.settled += s.settled;
    if (!s.live) break;
    await sleep(LOOP_MS);
  }
  return json({ ok: true, ms: Date.now() - t0, ...stats });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    if (body.action === "trade") return await trade(sb, body);
    if (body.action === "settle") {
      if (!isUuid(body.duel)) return fail("Bad duel");
      return json(await settle(sb, body.duel));
    }
    if (body.action === "coin") {
      if (!isMint(body.mint)) return fail("Paste a coin address");
      return json(await coin(sb, body.mint));
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Something went wrong", 502);
  }
  const { data: keyRow } = await sb.from("yr_config").select("value").eq("key", "ingest_key").maybeSingle();
  if (!keyRow || req.headers.get("x-ingest-key") !== keyRow.value) return fail("forbidden", 403);
  return cron(sb);
});
