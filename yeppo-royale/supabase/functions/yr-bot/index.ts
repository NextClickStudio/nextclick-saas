// yr-bot: yeppo's own paper traders, the live test of the tool. Called by pg_cron every 30 s with the ingest key.
// The four paper wallets (1000 SOL each) are listed in yr_config 'paper_bots'. Each run reads the most traded
// young coins exactly as the extension does (yeppo.it/api/read) and paper-trades them with 0.1 SOL, once per
// coin, at the real curve price with fees (yr_paper_buy). The cron yr_paper_auto sells each position when its
// take profit, stop or time limit hits.
//   bot:yeppo   buys what yeppo calls "Runner potential", with its Exit Plan levels
//   bot:random  at the same moment buys a random other coin of the board, with the same plan levels
//   bot:avoid   buys what yeppo calls "Likely dump" or "Rug risk", with its plan levels
//   bot:all     buys every coin that gets a verdict, with its plan levels: what a coin of the board does
// The scout looks wider than the board (yr_scout_feed: up to 60 young coins traded in the last 2 minutes) and
// runs the checks expert traders use before a buy (see SAFE and ACTIVE below):
//   bot:scout   expert checks pass AND yeppo calls it Runner potential, with its Exit Plan
//   bot:expert  expert checks pass, yeppo not asked (default levels): what the checklist alone does
//   bot:safe    safety checks pass AND yeppo does not flag it (no Likely dump, no Rug risk), with its plan
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const SITE = "https://yeppo.it";
const SIZE = 0.1;
const BOTS = ["bot:yeppo", "bot:random", "bot:avoid", "bot:all", "bot:scout", "bot:expert", "bot:safe"] as const;
type Bot = (typeof BOTS)[number];
type Plan = { go: boolean; tp: number; stop: number; minutes: number };
type Read = { mint: string; verdict: { tone: string; label: string } | null; plan: Plan | null; error?: string };
const DEFAULT: Plan = { go: false, tp: 1.4, stop: 0.75, minutes: 4 };

// the expert checklist on yeppo's features (yr_ofeat, 0-based): f[0] ln(mc / 27.96 SOL), f[2] ln(mc / a minute
// ago), f[4] ln(1 + trades last minute), f[5] buy share, f[8] ln(1 + wallets), f[9] dev share, f[10] top 10
// share, f[11] snipers' share, f[17] the dev's rug rate. Thresholds from public trader checklists (Axiom
// Pulse, GMGN): top 10 under 25%, dev under 5%, snipers and bundles under 15%, no serial rugger, no bot ladder.
type Rule = (f: number[], ladder: boolean) => boolean;
const SAFE: Rule[] = [(f) => f[10] < 0.25, (f) => f[9] < 0.05, (f) => f[11] < 0.15, (f) => (f[17] ?? 0) < 0.5, (_, l) => !l];
// activity floors: 20+ trades in the last minute, 40+ wallets, more buys than sells, not up 50% in the last minute
// (no buying a vertical candle), market cap 40+ SOL
const ACTIVE: Rule[] = [(f) => Math.exp(f[4]) - 1 >= 20, (f) => Math.exp(f[8]) - 1 >= 40, (f) => f[5] >= 0.55, (f) => f[2] < Math.log(1.5), (f) => 27.96 * Math.exp(f[0]) >= 40];
const pass = (rules: Rule[], f: number[], l: boolean) => rules.every((r) => r(f, l));

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: cfg } = await sb.from("yr_config").select("key,value").in("key", ["ingest_key", "paper_bots"]);
  if (req.headers.get("x-ingest-key") !== cfg?.find((r) => r.key === "ingest_key")?.value) return new Response("forbidden", { status: 403 });

  // the bots' paper wallets, made once (by the first run) and kept in yr_config 'paper_bots'
  const ids = JSON.parse(cfg?.find((r) => r.key === "paper_bots")?.value ?? "{}") as Record<Bot, string>;
  if (BOTS.some((b) => !ids[b])) return Response.json({ error: "paper_bots is not set up" }, { status: 500 });

  const { data: hot } = await sb.rpc("yr_oracle_hot");
  const coins = ((hot?.coins ?? []) as unknown[][]).map((c) => c[0] as string);
  // the scout's wider look: each coin with its features now and whether it passes the safety and the full checks
  const { data: feed } = await sb.rpc("yr_scout_feed", { p_n: 60 });
  const scouted = ((feed ?? []) as [string, number[] | null, boolean][])
    .filter(([, f]) => Array.isArray(f) && f.length >= 18)
    .map(([mint, f, l]) => ({ mint, safe: pass(SAFE, f!, l), full: pass(SAFE, f!, l) && pass(ACTIVE, f!, l) }))
    .filter((c) => c.safe);
  const all = [...new Set([...coins, ...scouted.map((c) => c.mint)])];
  if (!all.length) return Response.json({ ok: true, coins: 0 });

  // coins each bot already traded: once per coin
  const { data: done } = await sb.from("yr_paper_fill").select("acct,mint").in("acct", Object.values(ids)).in("mint", all).eq("side", 1);
  const has = new Set((done ?? []).map((d) => `${d.acct}:${d.mint}`));
  // read the board, plus the scouted coins no scout bot traded yet (at most 12 a run, to keep the database light)
  const fresh = scouted.filter((c) => !coins.includes(c.mint) && !["bot:scout", "bot:expert", "bot:safe"].every((b) => has.has(`${ids[b as Bot]}:${c.mint}`)));
  const toRead = [...coins, ...fresh.slice(0, 12).map((c) => c.mint)];
  const reads = (
    await Promise.all(
      toRead.map((m) =>
        fetch(`${SITE}/api/read?mint=${m}`, { signal: AbortSignal.timeout(9000) })
          .then((r) => r.json() as Promise<Read>)
          .catch(() => null),
      ),
    )
  ).filter((r): r is Read => !!r && !r.error && !!r.verdict);

  const out: string[] = [];
  const buy = async (bot: Bot, mint: string, p: Plan, why: string) => {
    if (has.has(`${ids[bot]}:${mint}`)) return;
    has.add(`${ids[bot]}:${mint}`);
    const { error } = await sb.rpc("yr_paper_buy", { p_acct: ids[bot], p_mint: mint, p_sol: SIZE, p_tp: p.tp, p_stop: p.stop, p_minutes: p.minutes });
    out.push(`${bot} ${mint.slice(0, 6)} ${why}${error ? ` ✗ ${error.message}` : ""}`);
  };
  const board = new Set(coins);
  const scout = new Map(scouted.map((c) => [c.mint, c]));
  // the checklist alone does not ask yeppo: it buys on the checks, even when the read failed
  for (const c of scouted) if (c.full) await buy("bot:expert", c.mint, DEFAULT, "expert checks");
  for (const r of reads) {
    const p = r.plan ?? DEFAULT;
    const sc = scout.get(r.mint);
    if (sc?.full && r.verdict!.tone === "up") await buy("bot:scout", r.mint, p, r.plan?.go ? "checks + runner, plan go" : "checks + runner");
    if (sc?.safe && r.verdict!.tone !== "down" && r.verdict!.tone !== "rug") await buy("bot:safe", r.mint, p, `safe + ${r.verdict!.label}`);
    if (!board.has(r.mint)) continue;
    await buy("bot:all", r.mint, p, r.verdict!.label);
    if (r.verdict!.tone === "up") {
      await buy("bot:yeppo", r.mint, p, r.plan?.go ? "runner, plan go" : "runner");
      // the control: another coin of the same board, right now, with the same levels
      const others = reads.filter((o) => board.has(o.mint) && o.mint !== r.mint && !has.has(`${ids["bot:random"]}:${o.mint}`));
      if (others.length) await buy("bot:random", others[Math.floor(Math.random() * others.length)].mint, p, "control");
    }
    if (r.verdict!.tone === "down" || r.verdict!.tone === "rug") await buy("bot:avoid", r.mint, p, r.verdict!.label);
  }
  return Response.json({ ok: true, coins: coins.length, scouted: scouted.length, reads: reads.length, trades: out });
});
