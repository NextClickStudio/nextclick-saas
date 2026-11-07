// yr-launch: yeppo's own launch reader, in place of a paid RPC. Called by pg_cron every minute, runs 50 s.
// The launch bundle (the wallets that bought in a coin's first 2 blocks, and how much of the supply each got) is read
// from the public Solana RPC, the same way lib/launch.ts read it through Helius: the coin's signatures (oldest at the
// end), then the transactions of its first 2 blocks, whose token balances stay whole even when their logs are cut.
// What makes the free node enough:
//   * the launch's block: the capture keeps each launch's signature and block (yr_obirth), so the 2 launch blocks are
//     read straight away (3 calls), however busy the coin has become; paging back is only for coins without them;
//   * the moment: a coin is read as soon as it has 20 trades (yr_launch_need, freshest first), when it still has
//     fewer than 1,000 transactions, so one page of signatures reaches its launch;
//   * the pace: one call at a time, as fast as the node allows and no faster: about one transaction a second per
//     address (measured 4 Nov 2026), so the gap between calls grows on every 429 and shrinks again while calls pass;
//   * all or nothing: a launch is written only when every one of its first transactions came back. A coin the node
//     didn't fully answer is tried again a minute later (3 tries), never written half read.
// Each launch is read once and kept in yr_launch for every user.
// A coin someone opens before this got to it is read here too, right away: yeppo.it's coin read books it
// (yr_launch_claim) and calls this function with ?mint= and the server's secret (yr_config api_secret). The public
// node answers Supabase's servers; Vercel's, shared by many sites, it mostly turns away (measured 4 Nov 2026).
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const RUN_MS = 50_000;
const RPC = "https://api.mainnet-beta.solana.com";
const GAP_MIN = 300;
const GAP_MAX = 3000;
const PAGES = 5;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Sig = { signature: string; slot: number; err: unknown };
type Bal = { accountIndex: number; mint: string; owner?: string; uiTokenAmount: { amount: string } };
// a block's transaction with transactionDetails "accounts": its signatures, its accounts (who signed) and its token balances
type Tx = { meta?: { err: unknown; preTokenBalances?: Bal[]; postTokenBalances?: Bal[] }; transaction?: { signatures?: string[]; accountKeys?: { pubkey: string; signer: boolean }[] } };

class Busy extends Error {}
let last = 0;
let gap = 1000; // between two calls, adjusted to what the node allows
/** one call to the node, paced; a 429 or a dropped call slows the pace and tries again (3 times), then gives up on
 *  the coin for now */
async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  for (let i = 0; i < 3; i++) {
    const wait = last + gap - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    try {
      const r = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8000),
      });
      const j = r.status === 429 || r.status >= 500 ? null : await r.json();
      if (!j || j.error?.code === 429) {
        gap = Math.min(GAP_MAX, gap * 2);
        await sleep(gap);
        continue;
      }
      if (j.error) throw new Busy(j.error.message ?? "rpc error");
      gap = Math.max(GAP_MIN, gap * 0.93);
      return j.result as T;
    } catch (e) {
      if (e instanceof Busy) throw e;
      await sleep(500);
    }
  }
  throw new Busy(`${method}: no answer`);
}

type Launch = { slot: number; dev: string | null; wallets: [string, number][]; took: number };

/** the launch block of a coin from what the capture kept of its launch (yr_obirth): the block itself, or the
 *  signature it gets the block from (one call); null when neither is known */
async function launchSlot(sb: ReturnType<typeof createClient>, mint: string): Promise<number | null> {
  const { data } = await sb.from("yr_obirth").select("sig,slot").eq("mint", mint).maybeSingle();
  if (data?.slot) return Number(data.slot);
  if (!data?.sig) return null;
  const st = await rpc<{ value: ({ slot: number } | null)[] }>("getSignatureStatuses", [[data.sig], { searchTransactionHistory: true }]);
  return st?.value?.[0]?.slot ?? null;
}

/** the launch bundle, or null when the coin has no pump.fun launch to read (too busy to page back to it) */
async function readLaunch(mint: string, sb?: ReturnType<typeof createClient>): Promise<Launch | null> {
  // the launch's block known: its 2 blocks straight away, however many transactions the coin has had since
  const known = sb ? await launchSlot(sb, mint) : null;
  if (known != null) {
    const l = await fromBlocks(mint, known, null);
    if (l) return l;
  }
  let all: Sig[] = [];
  let before: string | undefined;
  for (let p = 0; p < PAGES; p++) {
    const page = await rpc<Sig[]>("getSignaturesForAddress", [mint, { limit: 1000, ...(before ? { before } : {}) }]);
    if (!page?.length) break;
    all = all.concat(page);
    if (page.length < 1000) break;
    before = page[page.length - 1].signature;
    if (p === PAGES - 1) return null;
  }
  const ok = all.filter((s) => !s.err);
  if (!ok.length) throw new Busy("no signatures yet");
  const slot0 = Math.min(...ok.map((s) => s.slot));
  const want = new Set(ok.filter((s) => s.slot <= slot0 + 1).map((s) => s.signature));
  return fromBlocks(mint, slot0, want);
}

/** the launch bundle from the coin's 2 launch blocks: every transaction in them that moved this coin (or, given the
 *  signatures, those), read whole (token balances of every transaction, ~1 MB a block): 2 calls instead of one per
 *  transaction, and the node's limit on getBlock is separate from getTransaction's (4 Nov 2026: same result as
 *  Helius, 1-2 s a coin). null when no launch transaction is in them */
async function fromBlocks(mint: string, slot0: number, want: Set<string> | null): Promise<Launch | null> {
  const txs: Tx[] = [];
  for (const slot of [slot0, slot0 + 1]) {
    const b = await rpc<{ transactions: Tx[] } | null>("getBlock", [
      slot,
      { encoding: "jsonParsed", transactionDetails: "accounts", maxSupportedTransactionVersion: 1, rewards: false, commitment: "confirmed" },
    ]);
    if (!b) throw new Busy("block not served yet");
    for (const t of b.transactions) {
      const mine = want
        ? want.has(t.transaction?.signatures?.[0] ?? "")
        : [...(t.meta?.preTokenBalances ?? []), ...(t.meta?.postTokenBalances ?? [])].some((x) => x.mint === mint);
      if (mine) txs.push(t);
    }
  }
  // a transaction the node listed but the blocks don't hold: the whole launch waits for the next try
  if (want && txs.length < want.size) throw new Busy("block without the coin's transactions");
  // what each owner received in those transactions. pump.fun's bonding curve is not a buyer: it receives the whole
  // supply in the launch transaction (the one where everything received adds up to the supply, signed by the creator)
  // and hands tokens out in every buy after it, so the owner taking the most in that transaction, and any owner
  // giving tokens out, are left out
  const got = new Map<string, number>();
  const curve = new Set<string>();
  let launchTx: Tx | null = null;
  for (const t of txs) {
    const m = t.meta;
    if (!m || m.err) continue;
    const pre = new Map((m.preTokenBalances ?? []).filter((b) => b.mint === mint).map((b) => [b.accountIndex, Number(b.uiTokenAmount.amount)]));
    const inTx = new Map<string, number>();
    for (const b of m.postTokenBalances ?? []) {
      if (b.mint !== mint || !b.owner) continue;
      const d = Number(b.uiTokenAmount.amount) - (pre.get(b.accountIndex) ?? 0);
      if (d < 0) curve.add(b.owner);
      else if (d > 0) inTx.set(b.owner, (inTx.get(b.owner) ?? 0) + d);
    }
    const sum = [...inTx.values()].reduce((a, v) => a + v, 0);
    if (sum >= 0.999e15) {
      curve.add([...inTx].sort((x, y) => y[1] - x[1])[0][0]);
      launchTx = t;
    }
    for (const [o, d] of inTx) got.set(o, (got.get(o) ?? 0) + d);
  }
  for (const c of curve) got.delete(c);
  for (const [o, d] of got) if (d >= 0.5e15) got.delete(o);
  // the launch must be among the first two blocks found: on a coin too busy to page back that far, the oldest
  // transaction found is a later trade, and its "first blocks" would be any two blocks of its life
  if (!launchTx) return null;
  const dev = launchTx.transaction?.accountKeys?.find((k) => k.signer)?.pubkey ?? null;
  const wallets = [...got].map(([w, a]) => [w, a / 1e15] as [string, number]).filter(([w, s]) => w !== dev && s >= 0.001).sort((a, b) => b[1] - a[1]).slice(0, 60);
  return { slot: slot0, dev, wallets, took: wallets.reduce((a, w) => a + w[1], 0) };
}

/** one coin someone opened: read and kept, or handed back (yr_launch_try) for another attempt in 5 s */
async function readOne(sb: ReturnType<typeof createClient>, mint: string): Promise<void> {
  gap = 600;
  try {
    const l = await readLaunch(mint, sb);
    if (l) await sb.from("yr_launch").upsert({ mint, t: Date.now(), slot: l.slot, dev: l.dev, wallets: l.wallets, took: l.took, src: "open" }, { onConflict: "mint", ignoreDuplicates: true });
    else await sb.from("yr_launch_try").update({ final: true }).eq("mint", mint);
  } catch {
    await sb.from("yr_launch_try").update({ t: Date.now() - 25_000 }).eq("mint", mint);
  }
}

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

Deno.serve(async (req) => {
  const started = Date.now();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const one = new URL(req.url).searchParams.get("mint");
  if (one) {
    const { data: sec } = await sb.from("yr_config").select("value").eq("key", "api_secret").maybeSingle();
    if (!sec?.value || req.headers.get("x-yeppo-secret") !== sec.value) return new Response("forbidden", { status: 403 });
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(one)) return Response.json({ error: "bad mint" }, { status: 400 });
    // answered at once, read after: the caller doesn't wait, and the read isn't cut when it hangs up
    EdgeRuntime.waitUntil(readOne(sb, one));
    return Response.json({ started: true }, { status: 202 });
  }
  const { data: keyRow } = await sb.from("yr_config").select("value").eq("key", "ingest_key").maybeSingle();
  if (!keyRow || req.headers.get("x-ingest-key") !== keyRow.value) return new Response("forbidden", { status: 403 });
  const { data: lease } = await sb.rpc("yr_take_lease_k", { p_key: "launch_lease", p_ms: RUN_MS + 5_000 });
  if (!lease) return Response.json({ skipped: true });

  const stats = { read: 0, none: 0, retry: 0 };
  while (Date.now() - started < RUN_MS) {
    const { data: need } = await sb.rpc("yr_launch_need", { p_n: 10 });
    const mints = (need ?? []) as string[];
    if (!mints.length) {
      await sleep(5000);
      continue;
    }
    for (const mint of mints) {
      if (Date.now() - started > RUN_MS) break;
      try {
        const l = await readLaunch(mint, sb);
        if (l) {
          await sb.from("yr_launch").upsert(
            { mint, t: Date.now(), slot: l.slot, dev: l.dev, wallets: l.wallets, took: l.took, src: "rpc" },
            { onConflict: "mint", ignoreDuplicates: true },
          );
          stats.read++;
        } else {
          // nothing to read (no pump.fun launch, or too busy to reach it): not asked again
          await sb.rpc("yr_launch_tried", { p_mint: mint, p_final: true });
          stats.none++;
        }
      } catch {
        await sb.rpc("yr_launch_tried", { p_mint: mint, p_final: false });
        stats.retry++;
      }
    }
  }
  return Response.json({ ...stats, gap: Math.round(gap) });
});
