// yr-bot: yeppo's own paper traders, the live test of the tool. Called by pg_cron every 30 s with the ingest key.
// The four paper wallets (1000 SOL each) are listed in yr_config 'paper_bots'. Each run reads the most traded
// young coins exactly as the extension does (yeppo.it/api/read) and paper-trades them with 0.1 SOL, once per coin, at the real curve price with fees (yr_paper_buy). The cron yr_paper_auto
// sells each position when its take profit, stop or time limit hits.
//   bot:yeppo   buys what yeppo calls "Runner potential" with a plan that worked on the look-alikes
//   bot:random  at the same moment buys a random other coin of the board, with the same plan levels
//   bot:avoid   buys what yeppo calls "Likely dump" or "Rug risk", with its plan levels
//   bot:all     buys every coin that gets a verdict, with its plan levels: what a coin of the board does
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const SITE = "https://yeppo.it";
const SIZE = 0.1;
const BOTS = ["bot:yeppo", "bot:random", "bot:avoid", "bot:all"] as const;
type Bot = (typeof BOTS)[number];
type Plan = { go: boolean; tp: number; stop: number; minutes: number };
type Read = { mint: string; verdict: { tone: string; label: string } | null; plan: Plan | null; error?: string };
const DEFAULT: Plan = { go: false, tp: 1.4, stop: 0.75, minutes: 4 };

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: cfg } = await sb.from("yr_config").select("key,value").in("key", ["ingest_key", "paper_bots"]);
  if (req.headers.get("x-ingest-key") !== cfg?.find((r) => r.key === "ingest_key")?.value) return new Response("forbidden", { status: 403 });

  // the bots' paper wallets, made once (by the first run) and kept in yr_config 'paper_bots'
  const ids = JSON.parse(cfg?.find((r) => r.key === "paper_bots")?.value ?? "{}") as Record<Bot, string>;
  if (BOTS.some((b) => !ids[b])) return Response.json({ error: "paper_bots is not set up" }, { status: 500 });

  const { data: hot } = await sb.rpc("yr_oracle_hot");
  const coins = ((hot?.coins ?? []) as unknown[][]).map((c) => c[0] as string);
  if (!coins.length) return Response.json({ ok: true, coins: 0 });

  // coins each bot already traded: once per coin
  const { data: done } = await sb.from("yr_paper_fill").select("acct,mint").in("acct", Object.values(ids)).in("mint", coins).eq("side", 1);
  const has = new Set((done ?? []).map((d) => `${d.acct}:${d.mint}`));
  const reads = (
    await Promise.all(
      coins.map((m) =>
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
  for (const r of reads) {
    const p = r.plan ?? DEFAULT;
    await buy("bot:all", r.mint, p, r.verdict!.label);
    if (r.verdict!.tone === "up" && r.plan?.go) {
      await buy("bot:yeppo", r.mint, r.plan, "runner");
      // the control: another coin of the same board, right now, with the same levels
      const others = reads.filter((o) => o.mint !== r.mint && !has.has(`${ids["bot:random"]}:${o.mint}`));
      if (others.length) await buy("bot:random", others[Math.floor(Math.random() * others.length)].mint, r.plan, "control");
    }
    if (r.verdict!.tone === "down" || r.verdict!.tone === "rug") await buy("bot:avoid", r.mint, p, r.verdict!.label);
  }
  return Response.json({ ok: true, coins: coins.length, reads: reads.length, trades: out });
});
