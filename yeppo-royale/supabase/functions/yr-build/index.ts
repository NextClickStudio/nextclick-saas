// yr-build: turns captured pump.fun launches into a ready-to-play arena.
//  1. classify finished launches (runner, pump & dump, rug, bleed, chop)
//  2. pick a mix of them and stagger their launches across the match
//  3. simulate 99 AI traders with different styles on the real trades
// Called by pg_cron (and by hand) with the ingest key.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

const WINDOW_MS = 20 * 60_000;
const TPL_DUR = 24 * 60_000; // royale: 8 min at 3x
const STEP = 3000;
const SUPPLY = 1e9;
const FEE = 0.01;
const START = 10;
const NBOTS = 99;
const SLOTS = [0, 25_000, 60_000, 100_000, 150_000, 210_000, 280_000, 360_000];
const CUTS_TPL = [270_000, 540_000, 810_000, 1_080_000, 1_260_000, 1_440_000];
const BLOCK = /(nigg|n1gg|fag|rape|hitler|nazi|kkk|retard|kike|chink|spic|tranny|porn|nsfw|dick|cock|pussy|fuck|cunt|whore|slut|9\/11|isis|jihad)/i;

type Stat = {
  id: number; mint: string; name: string; symbol: string; created_ms: number; n: number; status: string;
  init_mc: number; peak_mc: number; peak_t: number; final_mc: number; last_t: number;
  dev_bought: number; dev_sold: number; dev_sell_t: number | null; wallets: number; migrated_t: number | null; used: number; has_social: boolean;
};
type Ev = { t: number; seq: number; w: number; k: number; sol: number; tok: number; mc: number; vsol: number | null };
type Snap = { mc: number; vsol: number | null; holders: number; top10: number; dev: number; devSold: boolean; buys: number; sells: number; buyVol: number; sellVol: number; mcAgo: number; ath: number };
type Outcome = "runner" | "pump" | "rug" | "bleed" | "mid";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const fmt = (ms: number) => `${Math.floor(ms / 60000)}m ${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}s`;

function classify(s: Stat): { outcome: Outcome; note: string; stats: Record<string, unknown> } {
  const init = s.init_mc || 1;
  const xPeak = s.peak_mc / init;
  const xFinal = s.final_mc / init;
  const drop = s.peak_mc ? s.final_mc / s.peak_mc : 0;
  const devSold = s.dev_bought > 0 ? Math.min(1, s.dev_sold / s.dev_bought) : 0;
  const graduated = s.migrated_t != null;
  const base = { x_peak: +xPeak.toFixed(2), x_final: +xFinal.toFixed(2), dev_sold: +(devSold * 100).toFixed(0), graduated };
  if (devSold >= 0.5 && xFinal < 1) {
    return { outcome: "rug", note: `Dev sold ${(devSold * 100).toFixed(0)}%${s.dev_sell_t != null ? ` at ${fmt(s.dev_sell_t)}` : ""} · ended at ${xFinal.toFixed(2)}x`, stats: base };
  }
  if ((xPeak >= 3 && drop >= 0.5) || graduated) {
    return { outcome: "runner", note: `Ran ${xPeak.toFixed(1)}x${graduated ? " and graduated" : ""}`, stats: base };
  }
  if (xPeak >= 2.2 && drop < 0.5) {
    return { outcome: "pump", note: `Pumped ${xPeak.toFixed(1)}x, then dumped ${((1 - drop) * 100).toFixed(0)}%`, stats: base };
  }
  if (xFinal < 0.85 && xPeak < 1.8) {
    return { outcome: "bleed", note: `Never took off · ended at ${xFinal.toFixed(2)}x`, stats: base };
  }
  return { outcome: "mid", note: `Chopped around · peaked at ${xPeak.toFixed(1)}x`, stats: base };
}

function snapshots(evs: Ev[]): Snap[] {
  const out: Snap[] = [];
  const bal = new Map<number, number>();
  let i = 0;
  let lo = 0;
  let mc = 0;
  let vsol: number | null = null;
  let ath = 0;
  let devSold = false;
  let devBought = 0;
  let top10 = 0;
  let holders = 0;
  const mcHist: number[] = [];
  const steps = Math.ceil(WINDOW_MS / STEP);
  for (let s = 0; s <= steps; s++) {
    const T = s * STEP;
    let changed = false;
    while (i < evs.length && evs[i].t <= T) {
      const e = evs[i++];
      const prev = bal.get(e.w) ?? 0;
      bal.set(e.w, e.k === 2 ? Math.max(0, prev - e.tok) : prev + e.tok);
      if (e.w === 0 && e.k !== 2) devBought += e.tok;
      if (e.w === 0 && e.k === 2) devSold = true;
      mc = e.mc;
      vsol = e.vsol;
      if (mc > ath) ath = mc;
      changed = true;
    }
    if (changed && (s % 2 === 0 || bal.size < 400)) {
      const b: number[] = [];
      holders = 0;
      for (const v of bal.values()) {
        if (v > 1) {
          holders++;
          b.push(v);
        }
      }
      b.sort((x, y) => y - x);
      let sum = 0;
      for (let j = 0; j < Math.min(10, b.length); j++) sum += b[j];
      top10 = (sum / SUPPLY) * 100;
    }
    while (lo < i && evs[lo].t < T - 60_000) lo++;
    let buys = 0;
    let sells = 0;
    let buyVol = 0;
    let sellVol = 0;
    for (let j = lo; j < i; j++) {
      if (evs[j].k === 2) {
        sells++;
        sellVol += evs[j].sol;
      } else {
        buys++;
        buyVol += evs[j].sol;
      }
    }
    mcHist.push(mc);
    void devBought;
    out.push({
      mc,
      vsol,
      holders,
      top10,
      dev: ((bal.get(0) ?? 0) / SUPPLY) * 100,
      devSold,
      buys,
      sells,
      buyVol,
      sellVol,
      mcAgo: mcHist[Math.max(0, s - 20)] || mc,
      ath,
    });
  }
  return out;
}

const NAME_A = ["degen", "ape", "sol", "rug", "moon", "based", "pump", "giga", "chad", "anon", "wen", "gm", "ser", "fren", "whale", "sniper", "bag", "ngmi", "wagmi", "fomo", "trench", "jeet", "mev", "bonk", "dip", "send", "lambo", "alpha"];
const NAME_B = ["lord", "king", "420", "69", "maxi", "hunter", "bro", "enjoyer", "er", "boy", "girl", "x", "100x", "god", "_sol", "chan", "wizard", "rat", "goblin", "dev", "zone", "pilled"];

function botIdentity(r: () => number, used: Set<string>) {
  let name = "";
  for (let k = 0; k < 6; k++) {
    const a = NAME_A[Math.floor(r() * NAME_A.length)];
    const b = NAME_B[Math.floor(r() * NAME_B.length)];
    const style = r();
    name = style < 0.4 ? `${a}${b}` : style < 0.7 ? `${a}_${b}` : `${a}${Math.floor(r() * 999)}`;
    if (!used.has(name)) break;
  }
  used.add(name);
  const n = (m: number) => Math.floor(r() * m);
  return { name, avatar: { s: n(12), e: n(8), m: n(8), h: n(10), g: r() < 0.55 ? 0 : n(6), o: n(7), b: n(10) } };
}

type Archetype = "sniper" | "analyst" | "momentum" | "degen" | "paper" | "holder" | "whale";
const MIX: [Archetype, number][] = [["sniper", 14], ["analyst", 22], ["momentum", 20], ["degen", 14], ["paper", 14], ["holder", 8], ["whale", 7]];

function simulate(coins: { ci: number; off: number; snaps: Snap[] }[], seed: number) {
  const fills: [number, number, number, number, number, number][] = [];
  const kinds: Archetype[] = [];
  for (const [k, n] of MIX) for (let i = 0; i < n; i++) kinds.push(k);
  const eqAt: number[][] = CUTS_TPL.map(() => []);
  const r0 = rng(seed);
  // shuffle so bot index doesn't reveal the style
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(r0() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const snapAt = (c: { off: number; snaps: Snap[] }, T: number) => {
    const ct = T - c.off;
    if (ct < 0) return null;
    return c.snaps[Math.min(c.snaps.length - 1, Math.floor(ct / STEP))];
  };
  for (let b = 0; b < NBOTS; b++) {
    const kind = kinds[b % kinds.length];
    const r = rng(seed * 131 + b * 7919);
    let cash = START;
    const pos = new Map<number, { tok: number; cost: number; entry: number; peak: number; at: number }>();
    const touched = new Set<number>();
    const p = {
      size: kind === "whale" ? 2.5 + r() * 1.5 : kind === "degen" ? 1 + r() * 2 : kind === "sniper" ? 0.3 + r() * 0.7 : 0.5 + r() * 1.5,
      tp: kind === "sniper" ? 1.6 + r() * 1.4 : kind === "analyst" || kind === "whale" ? 2.5 + r() * 2.5 : kind === "degen" ? 3 + r() * 5 : kind === "paper" ? 1.25 : 1.8 + r() * 1.5,
      sl: kind === "paper" ? 0.85 : kind === "degen" ? 0.2 : 0.55 + r() * 0.15,
      hold: (60 + r() * 240) * 1000,
      eagerness: 0.15 + r() * 0.5,
      maxOpen: kind === "holder" ? 2 : kind === "degen" ? 4 : 3,
    };
    const buy = (ci: number, s: Snap, T: number, amount: number) => {
      amount = Math.min(amount, cash);
      if (amount < 0.05 || !(s.mc > 0)) return;
      const vs = s.vsol ?? Math.max(s.mc * 0.2, 30);
      const vt = (vs * SUPPLY) / s.mc;
      const x = amount * (1 - FEE);
      const tok = (vt * x) / (vs + x);
      cash -= amount;
      const cur = pos.get(ci);
      if (cur) {
        cur.tok += tok;
        cur.cost += amount;
      } else pos.set(ci, { tok, cost: amount, entry: s.mc, peak: s.mc, at: T });
      touched.add(ci);
      fills.push([b, ci, T, 1, +amount.toFixed(4), Math.round(tok)]);
    };
    const sell = (ci: number, s: Snap, T: number, frac = 1) => {
      const cur = pos.get(ci);
      if (!cur || !(s.mc > 0)) return;
      const tok = frac >= 0.999 ? cur.tok : cur.tok * frac;
      const vs = s.vsol ?? Math.max(s.mc * 0.2, 30);
      const vt = (vs * SUPPLY) / s.mc;
      const sol = ((vs * tok) / (vt + tok)) * (1 - FEE);
      cash += sol;
      cur.tok -= tok;
      cur.cost *= 1 - tok / (tok + cur.tok || 1);
      if (cur.tok <= 1) pos.delete(ci);
      fills.push([b, ci, T, 2, +sol.toFixed(4), Math.round(tok)]);
    };
    let cutI = 0;
    for (let T = 0; T <= TPL_DUR; T += STEP) {
      for (const c of coins) {
        const s = snapAt(c, T);
        if (!s || !(s.mc > 0)) continue;
        const age = T - c.off;
        const live = age <= WINDOW_MS;
        const held = pos.get(c.ci);
        if (held) {
          held.peak = Math.max(held.peak, s.mc);
          if (!live) continue;
          const x = s.mc / held.entry;
          const inFor = T - held.at;
          let exit = false;
          switch (kind) {
            case "sniper":
              exit = x >= p.tp || x <= p.sl || inFor > p.hold;
              break;
            case "analyst":
            case "whale":
              exit = s.devSold || s.top10 > 48 || x <= p.sl || x >= p.tp || (x > 1.3 && s.mc < held.peak * 0.62);
              break;
            case "momentum":
              exit = s.mc < held.peak * 0.75 || inFor > p.hold * 0.8 || x <= p.sl;
              break;
            case "degen":
              exit = x >= p.tp || r() < 0.002;
              break;
            case "paper":
              exit = x >= p.tp || x <= p.sl;
              break;
            case "holder":
              exit = false;
              break;
          }
          if (exit) sell(c.ci, s, T, kind === "analyst" && x >= p.tp && r() < 0.5 ? 0.6 : 1);
          continue;
        }
        if (!live || touched.has(c.ci) || pos.size >= p.maxOpen || cash < 0.1) continue;
        const flowOk = s.buys >= s.sells * 1.15 && s.buyVol > s.sellVol;
        const grow = s.mcAgo > 0 ? s.mc / s.mcAgo : 1;
        switch (kind) {
          case "sniper":
            if (age <= 9_000 && r() < 0.5) buy(c.ci, s, T, p.size);
            break;
          case "analyst":
            if (age >= 20_000 && age <= 300_000 && r() < p.eagerness * 0.35 && s.holders >= 12 && s.dev <= 6 && !s.devSold && s.top10 <= 33 && flowOk && grow > 1.02)
              buy(c.ci, s, T, p.size + r());
            break;
          case "whale":
            if (age >= 60_000 && age <= 500_000 && r() < p.eagerness * 0.25 && s.holders >= 30 && !s.devSold && s.top10 <= 35 && flowOk) buy(c.ci, s, T, p.size);
            break;
          case "momentum":
            if (age <= 600_000 && grow >= 1.35 && s.buys > s.sells && r() < p.eagerness * 0.4) buy(c.ci, s, T, p.size);
            break;
          case "degen":
            if (age <= 400_000 && r() < 0.006) buy(c.ci, s, T, p.size * (0.5 + r()));
            break;
          case "paper":
            if (age >= 8_000 && age <= 90_000 && r() < 0.04) buy(c.ci, s, T, p.size);
            break;
          case "holder":
            if (age >= 4_000 && age <= 45_000 && r() < 0.05) buy(c.ci, s, T, 1.5 + r() * 1.5);
            break;
        }
      }
      while (cutI < CUTS_TPL.length && T >= CUTS_TPL[cutI]) {
        let eq = cash;
        for (const [ci, ps] of pos) {
          const c = coins.find((x) => x.ci === ci)!;
          const s = snapAt(c, T);
          eq += ps.tok * ((s?.mc ?? 0) / SUPPLY);
        }
        eqAt[cutI].push(eq);
        cutI++;
      }
    }
  }
  const q = (a: number[], f: number) => {
    const s = [...a].sort((x, y) => x - y);
    return s.length ? +s[Math.min(s.length - 1, Math.floor(f * s.length))].toFixed(2) : 0;
  };
  const dist = eqAt.map((a) => ({ p10: q(a, 0.1), med: q(a, 0.5), p90: q(a, 0.9), max: q(a, 0.999), up: a.filter((x) => x > START).length }));
  return { fills, kinds, dist };
}

// deno-lint-ignore no-explicit-any
async function loadEvents(sb: SupabaseClient<any, any, any>, coinId: number): Promise<Ev[]> {
  const out: Ev[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await sb
      .from("yr_events")
      .select("t,seq,w,k,sol,tok,mc,vsol")
      .eq("coin_id", coinId)
      .order("t")
      .order("seq")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data as Ev[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: keyRow } = await sb.from("yr_config").select("value").eq("key", "ingest_key").maybeSingle();
  if (!keyRow || req.headers.get("x-ingest-key") !== keyRow.value) return new Response("forbidden", { status: 403 });
  const body = await req.json().catch(() => ({}));
  const maxActive = Number(body.max_active ?? 60);

  const { count: active } = await sb.from("yr_templates").select("id", { count: "exact", head: true }).eq("active", true);
  if ((active ?? 0) >= maxActive && !body.force) return Response.json({ skipped: "enough arenas", active });

  const { data: raw, error } = await sb.rpc("yr_coin_stats", { p_before: Date.now() - WINDOW_MS - 90_000, p_min_events: 30, p_limit: 400 });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const stats = (raw as Stat[]).map((s) => ({ ...s, ...classify(s) }));
  const fresh = (o: Outcome) => stats.filter((s) => s.outcome === o).sort((a, b) => a.used - b.used || b.n - a.n);
  const pools: Record<Outcome, typeof stats> = { runner: fresh("runner"), pump: fresh("pump"), rug: fresh("rug"), bleed: fresh("bleed"), mid: fresh("mid") };
  const counts = Object.fromEntries(Object.entries(pools).map(([k, v]) => [k, v.length]));

  const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  const r = rng(seed);
  const want: Outcome[] = ["runner", "runner", "pump", "rug", "rug", "bleed", "mid", "mid"];
  const chosen: typeof stats = [];
  const takeFrom = (o: Outcome) => {
    // a little randomness among the least used coins of that kind
    const pool = pools[o].filter((s) => !chosen.includes(s) && s.used <= 3);
    if (!pool.length) return false;
    const pickIdx = Math.floor(Math.pow(r(), 2) * Math.min(pool.length, 6));
    chosen.push(pool[pickIdx]);
    return true;
  };
  for (const o of want) {
    if (!takeFrom(o)) {
      const fallback: Outcome[] = o === "runner" ? ["pump", "mid"] : o === "rug" ? ["bleed", "pump"] : ["mid", "bleed", "rug", "pump"];
      for (const f of fallback) if (takeFrom(f)) break;
    }
  }
  if (chosen.length < 6 || !chosen.some((c) => c.outcome === "runner" || c.outcome === "pump")) {
    return Response.json({ skipped: "not enough variety yet", counts, chosen: chosen.length });
  }

  // first launch should be alive; the rest are shuffled
  const order = [...chosen];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const firstLive = order.findIndex((c) => c.outcome !== "bleed");
  if (firstLive > 0) [order[0], order[firstLive]] = [order[firstLive], order[0]];

  const coins: { ci: number; off: number; snaps: Snap[]; stat: (typeof stats)[number] }[] = [];
  for (let ci = 0; ci < order.length; ci++) {
    const s = order[ci];
    const clean = !BLOCK.test(`${s.name} ${s.symbol}`);
    const { error: ce } = await sb.rpc("yr_curate", { p_coin: s.id, p_status: clean ? "ok" : "nsfw", p_outcome: s.outcome, p_stats: { ...s.stats, note: s.note } });
    if (ce) return Response.json({ error: ce.message }, { status: 500 });
    const evs = await loadEvents(sb, s.id);
    coins.push({ ci, off: SLOTS[ci], snaps: snapshots(evs), stat: s });
  }

  const sim = simulate(coins, seed);
  const used = new Set<string>();
  const ids = rng(seed ^ 0x9e3779b9);
  const bots = Array.from({ length: NBOTS }, () => botIdentity(ids, used));
  const tplStats = {
    seed,
    mix: coins.map((c) => ({ ci: c.ci, outcome: c.stat.outcome, x_peak: c.stat.stats.x_peak, n: c.stat.n })),
    cuts: sim.dist,
    kinds: Object.fromEntries(MIX.map(([k]) => [k, sim.kinds.filter((x) => x === k).length])),
    fills: sim.fills.length,
  };
  const { data: tid, error: pe } = await sb.rpc("yr_put_template", {
    p_dur: TPL_DUR,
    p_bots: bots,
    p_stats: tplStats,
    p_coins: coins.map((c) => ({ ci: c.ci, coin_id: c.stat.id, off: c.off })),
    p_fills: sim.fills,
  });
  if (pe) return Response.json({ error: pe.message }, { status: 500 });
  return Response.json({ ok: true, template: tid, counts, ...tplStats });
});
