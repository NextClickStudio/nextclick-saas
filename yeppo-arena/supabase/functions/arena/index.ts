// Yeppo Arena — trade engine. Every write to the arena goes through here:
// prices are fetched server-side, so nobody can fake a fill from the browser.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const SOL = "So11111111111111111111111111111111111111112";
const FEE = 0.01;
const MIN_LIQ_USD = 5000;
const MAX_BUY_SOL = 5;
const MAX_IMPACT = 0.2;
const QUICK_MINUTES = 15;
// pump.fun curve: vSol * vTokens = 30 * 1.073e9 → vSol = sqrt(mcapSol * 32.19)
const PUMP_K = 32.19;
const COLORS = ["#b6ff00", "#00f0ff", "#ff2e7e", "#9b5cff", "#ffd400", "#ff8a00", "#00ff9d", "#ff5cf4"];
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PLAYER_COLS = "id,room_id,nickname,color,cash,positions,realized,trades_count,final_equity,final_rank,joined_at,updated_at";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

class Fail extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

type Quote = {
  mint: string;
  symbol: string;
  image: string | null;
  priceSol: number;
  mcapUsd: number;
  liqUsd: number | null;
  reserveSol: number;
};

type Position = { qty: number; cost: number; symbol: string; image: string | null };

// deno-lint-ignore no-explicit-any
type Pair = any;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const pairScore = (p: Pair) => (p.liquidity?.usd != null ? 1e12 + p.liquidity.usd : +(p.volume?.h24 ?? 0));

function toQuote(p: Pair, solUsd: number): Quote | null {
  const priceUsd = +p.priceUsd;
  if (!(priceUsd > 0)) return null;
  const priceSol = p.quoteToken?.address === SOL && +p.priceNative > 0 ? +p.priceNative : priceUsd / solUsd;
  const mcapUsd = +(p.marketCap ?? p.fdv ?? 0);
  const liqUsd = p.liquidity?.usd != null ? +p.liquidity.usd : null;
  const reserveSol = liqUsd != null ? liqUsd / 2 / solUsd : Math.sqrt(Math.max(mcapUsd / solUsd, 1) * PUMP_K);
  return {
    mint: p.baseToken.address,
    symbol: p.baseToken.symbol ?? "???",
    image: p.info?.imageUrl ?? null,
    priceSol,
    mcapUsd,
    liqUsd,
    reserveSol,
  };
}

async function getQuotes(mints: string[]): Promise<Map<string, Quote>> {
  const wanted = [...new Set(mints.filter((m) => m && m !== SOL))];
  const out = new Map<string, Quote>();
  if (!wanted.length) return out;
  const pairs: Pair[] = [];
  for (let i = 0; i < wanted.length; i += 29) {
    const chunk = wanted.slice(i, i + 29);
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${[SOL, ...chunk].join(",")}`);
    if (!res.ok) throw new Fail("Prezzi non disponibili, riprova tra un attimo", 503);
    pairs.push(...(await res.json()));
  }
  let solUsd = 0;
  let solLiq = -1;
  for (const p of pairs) {
    if (p.baseToken?.address !== SOL || !/^USD/.test(p.quoteToken?.symbol ?? "")) continue;
    const liq = p.liquidity?.usd ?? 0;
    if (liq > solLiq && +p.priceUsd > 0) {
      solLiq = liq;
      solUsd = +p.priceUsd;
    }
  }
  if (!(solUsd > 0)) throw new Fail("Prezzo SOL non disponibile, riprova", 503);
  const best = new Map<string, Pair>();
  for (const p of pairs) {
    const mint = p.baseToken?.address;
    if (!mint || !wanted.includes(mint)) continue;
    const cur = best.get(mint);
    if (!cur || pairScore(p) > pairScore(cur)) best.set(mint, p);
  }
  for (const [mint, p] of best) {
    const q = toQuote(p, solUsd);
    if (q) out.set(mint, q);
  }
  return out;
}

// Constant-product fill against the real pool depth: big orders in thin pools get punished.
function buyFill(q: Quote, solIn: number) {
  const x = solIn * (1 - FEE);
  return x / (q.priceSol * (1 + x / q.reserveSol));
}

function sellValue(q: Quote, tokens: number) {
  const y = tokens * q.priceSol;
  return (y / (1 + y / q.reserveSol)) * (1 - FEE);
}

const randomCode = (n = 5) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");

async function roomByCode(code: unknown) {
  if (typeof code !== "string" || !code) throw new Fail("Stanza non valida");
  const { data, error } = await db.from("arena_rooms").select("*").eq("code", code.toUpperCase()).maybeSingle();
  if (error) throw error;
  if (!data) throw new Fail("Stanza non trovata", 404);
  return data;
}

async function createRoom(opts: {
  name: string;
  kind: string;
  minutes: number;
  startsInMinutes: number;
  maxPlayers: number;
  prizeSol: number;
  prizeNote: string | null;
  startBalance: number;
}) {
  const starts = Date.now() + opts.startsInMinutes * 60_000;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db
      .from("arena_rooms")
      .insert({
        code: randomCode(),
        name: opts.name,
        kind: opts.kind,
        prize_sol: opts.prizeSol,
        prize_note: opts.prizeNote,
        max_players: opts.maxPlayers,
        start_balance: opts.startBalance,
        starts_at: new Date(starts).toISOString(),
        ends_at: new Date(starts + opts.minutes * 60_000).toISOString(),
      })
      .select("*")
      .single();
    if (!error) return data;
    if (error.code !== "23505") throw error;
  }
  throw new Fail("Impossibile creare la stanza, riprova", 500);
}

async function authPlayer(playerId: unknown, secret: unknown) {
  if (typeof playerId !== "string" || typeof secret !== "string") throw new Fail("Sessione non valida", 401);
  const { data: key } = await db.from("arena_player_keys").select("secret").eq("player_id", playerId).maybeSingle();
  if (!key || key.secret !== secret) throw new Fail("Sessione non valida", 401);
}

async function join(body: Record<string, unknown>) {
  const room = await roomByCode(body.code);
  if (Date.now() >= Date.parse(room.ends_at)) throw new Fail("La stanza è già finita");
  const nickname = String(body.nickname ?? "").trim();
  if (!/^[\p{L}\p{N}_.\-]{2,16}$/u.test(nickname)) throw new Fail("Nickname: 2-16 caratteri (lettere, numeri, _ . -)");
  const { count } = await db.from("arena_players").select("id", { count: "exact", head: true }).eq("room_id", room.id);
  if ((count ?? 0) >= room.max_players) throw new Fail("Stanza piena");
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const { data: player, error } = await db
    .from("arena_players")
    .insert({ room_id: room.id, nickname, color, cash: room.start_balance })
    .select(PLAYER_COLS)
    .single();
  if (error) {
    if (error.code === "23505") throw new Fail("Nickname già usato in questa stanza");
    throw error;
  }
  const secret = crypto.randomUUID() + crypto.randomUUID();
  const { error: keyError } = await db.from("arena_player_keys").insert({ player_id: player.id, secret });
  if (keyError) throw keyError;
  return { player, secret, room };
}

async function quick() {
  const now = new Date().toISOString();
  const soon = new Date(Date.now() + 3 * 60_000).toISOString();
  const { data: rooms, error } = await db
    .from("arena_rooms_live")
    .select("*")
    .eq("kind", "quick")
    .lte("starts_at", now)
    .gt("ends_at", soon)
    .order("ends_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  const open = (rooms ?? []).find((r) => r.players < r.max_players);
  if (open) return { room: open };
  const { count } = await db.from("arena_rooms").select("id", { count: "exact", head: true }).eq("kind", "quick");
  const room = await createRoom({
    name: `Arena Rapida #${(count ?? 0) + 1}`,
    kind: "quick",
    minutes: QUICK_MINUTES,
    startsInMinutes: 0,
    maxPlayers: 50,
    prizeSol: 0,
    prizeNote: null,
    startBalance: 10,
  });
  return { room };
}

async function trade(body: Record<string, unknown>) {
  await authPlayer(body.player_id, body.secret);
  const mint = body.mint;
  if (typeof mint !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) throw new Fail("Contract address non valido");
  const side = body.side;
  if (side !== "buy" && side !== "sell") throw new Fail("Operazione non valida");

  const { data: first } = await db.from("arena_players").select(PLAYER_COLS).eq("id", body.player_id).maybeSingle();
  if (!first) throw new Fail("Sessione non valida", 401);
  const { data: room } = await db.from("arena_rooms").select("*").eq("id", first.room_id).maybeSingle();
  if (!room) throw new Fail("Stanza non trovata", 404);
  const now = Date.now();
  if (now < Date.parse(room.starts_at)) throw new Fail("La stanza non è ancora iniziata");
  if (now >= Date.parse(room.ends_at)) throw new Fail("Tempo scaduto: la stanza è finita");

  const q = (await getQuotes([mint])).get(mint);
  if (!q) throw new Fail("Coin non trovata su DexScreener");

  let player = first;
  for (let attempt = 0; attempt < 4; attempt++) {
    const positions: Record<string, Position> = { ...(player.positions ?? {}) };
    const pos: Position = positions[mint] ? { ...positions[mint] } : { qty: 0, cost: 0, symbol: q.symbol, image: q.image };
    let cash = +player.cash;
    let realized = +player.realized;
    let sol: number;
    let tokens: number;
    let pnl: number | null = null;

    if (side === "buy") {
      const amount = Math.round(+(body.amount ?? 0) * 1e4) / 1e4;
      if (!(amount >= 0.01)) throw new Fail("Importo minimo 0.01 SOL");
      if (amount > cash + 1e-9) throw new Fail("Saldo insufficiente");
      if (q.liqUsd != null && q.liqUsd < MIN_LIQ_USD) {
        throw new Fail("Liquidità sotto $5K: coin bloccata dall'anti-manipolazione");
      }
      const maxBuy = Math.min(MAX_BUY_SOL, MAX_IMPACT * q.reserveSol);
      if (amount > maxBuy + 1e-9) throw new Fail(`Massimo ${maxBuy.toFixed(2)} SOL per trade su questa coin`);
      sol = Math.min(amount, cash);
      tokens = buyFill(q, sol);
      pos.qty += tokens;
      pos.cost += sol;
      pos.symbol = q.symbol;
      pos.image = q.image;
      positions[mint] = pos;
      cash -= sol;
    } else {
      const pct = +(body.pct ?? 0);
      if (!(pct > 0 && pct <= 100)) throw new Fail("Percentuale non valida");
      if (!(pos.qty > 0)) throw new Fail("Non hai questa coin");
      tokens = pct >= 100 ? pos.qty : (pos.qty * pct) / 100;
      sol = sellValue(q, tokens);
      const costPart = pos.cost * (tokens / pos.qty);
      pnl = sol - costPart;
      pos.qty -= tokens;
      pos.cost -= costPart;
      if (pct >= 100 || pos.qty * q.priceSol < 1e-6) delete positions[mint];
      else positions[mint] = pos;
      cash += sol;
      realized += pnl;
    }

    const { data: updated, error } = await db
      .from("arena_players")
      .update({
        cash,
        positions,
        realized,
        trades_count: player.trades_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", player.id)
      .eq("updated_at", player.updated_at)
      .select(PLAYER_COLS)
      .maybeSingle();
    if (error) throw error;
    if (!updated) {
      const { data: fresh } = await db.from("arena_players").select(PLAYER_COLS).eq("id", player.id).maybeSingle();
      if (!fresh) throw new Fail("Sessione non valida", 401);
      player = fresh;
      continue;
    }

    const fill = {
      side,
      mint,
      symbol: q.symbol,
      image: q.image,
      sol,
      tokens,
      price_sol: sol / tokens,
      mcap_usd: q.mcapUsd,
      pnl_sol: pnl,
    };
    await db.from("arena_trades").insert({
      room_id: room.id,
      player_id: player.id,
      nickname: player.nickname,
      color: player.color,
      ...fill,
    });
    return { player: updated, fill };
  }
  throw new Fail("Troppi trade insieme, riprova", 409);
}

async function createRoomAdmin(body: Record<string, unknown>) {
  const { data: cfg } = await db.from("arena_config").select("value").eq("key", "admin_code").maybeSingle();
  if (!cfg || String(body.admin_code ?? "").trim() !== cfg.value) throw new Fail("Codice admin errato", 403);
  const name = String(body.name ?? "").trim();
  if (name.length < 3 || name.length > 40) throw new Fail("Nome: 3-40 caratteri");
  const num = (v: unknown, min: number, max: number, label: string) => {
    const n = +(v ?? NaN);
    if (!(n >= min && n <= max)) throw new Fail(`${label}: tra ${min} e ${max}`);
    return n;
  };
  const room = await createRoom({
    name,
    kind: body.private ? "private" : "official",
    minutes: num(body.minutes, 5, 240, "Durata (min)"),
    startsInMinutes: num(body.starts_in ?? 0, 0, 10080, "Inizio tra (min)"),
    maxPlayers: Math.round(num(body.max_players ?? 50, 2, 500, "Giocatori")),
    prizeSol: num(body.prize_sol ?? 0, 0, 1000, "Premio SOL"),
    prizeNote: body.prize_note ? String(body.prize_note).slice(0, 40) : null,
    startBalance: num(body.start_balance ?? 10, 1, 1000, "Saldo iniziale"),
  });
  return { room };
}

async function finalize(body: Record<string, unknown>) {
  if (typeof body.room_id !== "string") throw new Fail("Stanza non valida");
  const { data: room } = await db.from("arena_rooms").select("*").eq("id", body.room_id).maybeSingle();
  if (!room) throw new Fail("Stanza non trovata", 404);
  if (room.finalized) return { room };
  if (Date.now() < Date.parse(room.ends_at)) throw new Fail("La stanza non è ancora finita");
  const { data: players, error } = await db.from("arena_players").select("id,cash,positions,joined_at").eq("room_id", room.id);
  if (error) throw error;
  const mints = [...new Set((players ?? []).flatMap((p) => Object.keys(p.positions ?? {})))];
  const quotes = await getQuotes(mints);
  const ranked = (players ?? [])
    .map((p) => {
      let equity = +p.cash;
      for (const [mint, pos] of Object.entries(p.positions ?? {}) as [string, Position][]) {
        const q = quotes.get(mint);
        if (q && pos.qty > 0) equity += sellValue(q, pos.qty);
      }
      return { id: p.id, equity, joined: p.joined_at };
    })
    .sort((a, b) => b.equity - a.equity || Date.parse(a.joined) - Date.parse(b.joined));
  for (const [i, p] of ranked.entries()) {
    await db.from("arena_players").update({ final_equity: p.equity, final_rank: i + 1 }).eq("id", p.id);
  }
  const { data: done } = await db
    .from("arena_rooms")
    .update({ finalized: true })
    .eq("id", room.id)
    .select("*")
    .single();
  return { room: done };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    switch (body.action) {
      case "join":
        return json(await join(body));
      case "quick":
        return json(await quick());
      case "trade":
        return json(await trade(body));
      case "create_room":
        return json(await createRoomAdmin(body));
      case "finalize":
        return json(await finalize(body));
      default:
        throw new Fail("Azione sconosciuta");
    }
  } catch (e) {
    if (e instanceof Fail) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Errore del server, riprova" }, 500);
  }
});
