// Botmarket engine: runs every minute (pg_cron → pg_net). Every active bot paper-trades the
// real market on Binance public data; winning trades pay dividends to the bot's shareholders.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  ASSETS,
  CAPITAL,
  DIV_RATE,
  TF_MS,
  checkExit,
  levels,
  parseKlines,
  pnlUsd,
  prepare,
  signal,
  type Asset,
  type BotConfig,
  type Candle,
  type Position,
} from "./strategy.ts";

const KLINES = "https://data-api.binance.vision/api/v3/klines";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

let engineKey: string | null = null;

// deno-lint-ignore no-explicit-any
type BotRow = any;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function klines(asset: string, interval: string, limit: number): Promise<Candle[]> {
  const symbol = ASSETS[asset as Asset];
  if (!symbol) return [];
  const res = await fetch(`${KLINES}?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  if (!res.ok) throw new Error(`klines ${symbol} ${interval}: HTTP ${res.status}`);
  return parseKlines(await res.json());
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

async function openPosition(bot: BotRow, cfg: BotConfig, price: number, signalT: number, now: number) {
  const lv = levels(cfg.side, price, cfg.tp, cfg.sl);
  const position: Position = { side: cfg.side, entry: price, lev: cfg.leverage, opened_at: now, tp: lv.tp, sl: lv.sl, equity: +bot.equity };
  const { data, error } = await db
    .from("bm_bots")
    .update({ position, last_signal: signalT, updated_at: new Date(now).toISOString() })
    .eq("id", bot.id)
    .is("position", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  await db.from("bm_activity").insert({
    kind: "open",
    bot_id: bot.id,
    ticker: bot.ticker,
    emoji: bot.emoji,
    data: { side: cfg.side, lev: cfg.leverage, entry: price, asset: bot.asset },
  });
  return `${bot.ticker} open ${cfg.side} @ ${price}`;
}

async function closePosition(bot: BotRow, pos: Position, exit: number, reason: string, signalT: number, now: number) {
  const pnl = pnlUsd(pos.side, pos.lev, pos.entry, exit, pos.equity);
  const equity = Math.max(0, +bot.equity + pnl);
  const pct = (pnl / pos.equity) * 100;
  const rekt = equity < CAPITAL * 0.01;
  const { data, error } = await db
    .from("bm_bots")
    .update({
      position: null,
      equity,
      trades: bot.trades + 1,
      wins: bot.wins + (pnl > 0 ? 1 : 0),
      pnl_usd: +bot.pnl_usd + pnl,
      best_trade: Math.max(+bot.best_trade, pct),
      status: rekt ? "rekt" : "active",
      last_signal: Math.max(+bot.last_signal, signalT),
      updated_at: new Date(now).toISOString(),
    })
    .eq("id", bot.id)
    .not("position", "is", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  let dividend = 0;
  if (pnl > 0) {
    const { data: paid } = await db.rpc("bm_pay_dividend", { p_bot: bot.id, p_total: round(pnl * DIV_RATE) });
    dividend = +(paid ?? 0);
  }
  await db.from("bm_bot_trades").insert({
    bot_id: bot.id,
    side: pos.side,
    leverage: pos.lev,
    entry: pos.entry,
    exit,
    pnl_usd: pnl,
    pnl_pct: pct,
    equity_after: equity,
    reason,
    dividend,
    opened_at: new Date(pos.opened_at).toISOString(),
    closed_at: new Date(now).toISOString(),
  });
  const rows = [
    {
      kind: "close",
      bot_id: bot.id,
      ticker: bot.ticker,
      emoji: bot.emoji,
      data: { side: pos.side, lev: pos.lev, entry: pos.entry, exit, pnl: round(pnl), pct: round(pct), reason, dividend: round(dividend) },
    },
  ];
  if (rekt) rows.push({ kind: "rekt", bot_id: bot.id, ticker: bot.ticker, emoji: bot.emoji, data: { equity: round(equity) } as never });
  await db.from("bm_activity").insert(rows);
  return `${bot.ticker} close ${reason} ${round(pct)}%`;
}

async function runBot(bot: BotRow, series: Candle[], minutes: Candle[], now: number) {
  const cfg: BotConfig = {
    strategy: bot.strategy,
    params: bot.params ?? {},
    side: bot.side,
    leverage: bot.leverage,
    tp: +bot.tp,
    sl: +bot.sl,
    max_bars: bot.max_bars,
    tf: bot.tf,
  };
  const closed = series.filter((c) => c.T < now);
  if (closed.length < 30 || !minutes.length) return null;
  const price = minutes[minutes.length - 1].c;
  const i = closed.length - 1;
  const last = closed[i];
  const sig = signal(cfg, closed, prepare(cfg, closed), i);
  const pos = bot.position as Position | null;

  if (pos) {
    let exit: { price: number; reason: string } | null = null;
    for (const m of minutes) {
      if (m.T <= pos.opened_at) continue;
      // the minute that contains the entry only counts from the entry onwards: use its close
      const k = m.t < pos.opened_at ? { ...m, o: m.c, h: m.c, l: m.c } : m;
      const hit = checkExit(pos, k);
      if (hit) {
        exit = hit;
        break;
      }
    }
    if (!exit && sig.exit && last.T > pos.opened_at) exit = { price, reason: "signal" };
    if (!exit && now - pos.opened_at >= cfg.max_bars * TF_MS[cfg.tf]) exit = { price, reason: "time" };
    return exit ? await closePosition(bot, pos, exit.price, exit.reason, last.T, now) : null;
  }
  if (sig.enter && last.T > +bot.last_signal) return await openPosition(bot, cfg, price, last.T, now);
  return null;
}

Deno.serve(async (req) => {
  if (!engineKey) {
    const { data } = await db.from("bm_config").select("value").eq("key", "engine_key").maybeSingle();
    engineKey = data?.value ?? null;
  }
  if (!engineKey || req.headers.get("x-engine-key") !== engineKey) return json({ error: "unauthorized" }, 401);

  const { data: lease } = await db.rpc("bm_take_lease");
  if (!lease) return json({ skipped: "another tick is running" });

  const { data: bots, error } = await db.from("bm_bots").select("*").eq("status", "active");
  if (error) return json({ error: error.message }, 500);

  const now = Date.now();
  const series = new Map<string, Candle[]>();
  const minutes = new Map<string, Candle[]>();
  const pairs = [...new Set((bots ?? []).map((b: BotRow) => `${b.asset}|${b.tf}`))];
  const assets = [...new Set((bots ?? []).map((b: BotRow) => b.asset as string))];
  await Promise.all([
    ...pairs.map(async (key) => {
      const [asset, tf] = key.split("|");
      series.set(key, await klines(asset, tf, 300).catch(() => []));
    }),
    ...assets.map(async (asset) => minutes.set(asset, await klines(asset, "1m", 6).catch(() => []))),
  ]);

  const events: string[] = [];
  for (const bot of bots ?? []) {
    try {
      const ev = await runBot(bot, series.get(`${bot.asset}|${bot.tf}`) ?? [], minutes.get(bot.asset) ?? [], now);
      if (ev) events.push(ev);
    } catch (e) {
      console.error(bot.ticker, e);
    }
  }
  return json({ ok: true, bots: bots?.length ?? 0, events, ms: Date.now() - now });
});
