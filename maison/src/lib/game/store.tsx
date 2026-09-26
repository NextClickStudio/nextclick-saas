"use client";

/**
 * The whole game lives here, in the browser:
 *   - the market (every trend + 30-day history), loaded once and kept live with Supabase Realtime;
 *   - the player's state (maison, cards, forecast…), loaded in one call (`maison_state`);
 *   - every action (pack, buy, sell, call), applied instantly on screen and confirmed by the server.
 * Screens never wait for a page load: they read from here.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cardWorth, GAME_CONFIG, sellPrice } from "@/config/game";
import type { CardView } from "@/lib/cards/view";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { GameState, OwnedCard, Trend } from "./types";

type Status = "loading" | "signed-out" | "no-house" | "ready";

export interface Sheet {
  trendId: string;
  cardId?: string;
}

interface Game {
  status: Status;
  market: Map<string, Trend> | null;
  state: GameState | null;
  /** Live maison value: cash + every card at the live price. */
  worth: number;
  /** Last live tick per trend (for the flash), with its direction. */
  ticks: Record<string, { at: number; dir: 1 | -1 }>;
  userName: string;
  refresh: () => Promise<void>;
  openPack: (paid: boolean) => Promise<{ cards: OwnedCard[]; error?: undefined } | { error: string; cards?: undefined }>;
  buy: (trendId: string) => Promise<string | null>;
  sell: (cardId: string) => Promise<string | null>;
  call: (trendId: string, dir: 1 | -1) => Promise<string | null>;
  markRead: () => void;
  signOut: () => Promise<void>;
  sheet: Sheet | null;
  openSheet: (trendId: string, cardId?: string) => void;
  closeSheet: () => void;
}

const Ctx = createContext<Game | null>(null);

const MARKET_KEY = "maison:market:v2";
const STATE_KEY = "maison:state:v2";

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeCache(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the app works without it */
  }
}

const ERRORS: Record<string, string> = {
  already_opened: "Today's pack is already open. Next one at midnight UTC.",
  not_enough_credits: "Not enough credits.",
  not_listed: "This trend isn't on the market yet.",
  not_sellable: "This card was already sold.",
  already_called: "You already made this call.",
  not_in_forecast: "This trend isn't in today's forecast any more.",
};
const friendly = (msg: string) => Object.entries(ERRORS).find(([k]) => msg.includes(k))?.[1] ?? "Something went wrong. Try again.";

type TrendRow = {
  id: string;
  name: string;
  family: Trend["family"];
  style: Trend["style"] | null;
  value: number | string;
  day_open: number | string;
  source: string;
  updated_at: string;
  listed: boolean;
  active?: boolean;
};

const toTrend = (r: TrendRow, history: number[]): Trend => {
  const value = Number(r.value);
  const h = history.length ? [...history] : [value];
  if (h[h.length - 1] !== value) h.push(value);
  return {
    id: r.id,
    name: r.name,
    family: r.family,
    style: r.style ?? {},
    value,
    dayOpen: Number(r.day_open),
    source: r.source,
    updatedAt: r.updated_at,
    listed: r.listed,
    history: h.slice(-GAME_CONFIG.market.historyDays - 1),
  };
};

export function GameProvider({ children }: { children: React.ReactNode }) {
  const sb = supabaseBrowser();
  const [status, setStatus] = useState<Status>("loading");
  const [market, setMarket] = useState<Map<string, Trend> | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [ticks, setTicks] = useState<Game["ticks"]>({});
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [userName, setUserName] = useState("");
  const stateRef = useRef<GameState | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Instant paint from the last visit (after hydration: the static HTML has no cache).
  useEffect(() => {
    const m = readCache<Trend[]>(MARKET_KEY);
    const s = readCache<GameState>(STATE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage
    if (m) setMarket((cur) => cur ?? new Map(m.map((t) => [t.id, t])));
    if (s) setState((cur) => cur ?? s);
  }, []);

  const loadMarket = useCallback(async () => {
    const [{ data: rows }, { data: hist }] = await Promise.all([
      sb.from("maison_trends").select("id, name, family, style, value, day_open, source, updated_at, listed").eq("active", true),
      sb.rpc("maison_history", { p_ids: null, p_days: GAME_CONFIG.market.historyDays }),
    ]);
    if (!rows) return;
    const hMap = new Map(((hist ?? []) as { trend_id: string; points: number[] }[]).map((h) => [h.trend_id, h.points.map(Number)]));
    const list = (rows as TrendRow[]).map((r) => toTrend(r, hMap.get(r.id) ?? []));
    setMarket(new Map(list.map((t) => [t.id, t])));
    writeCache(MARKET_KEY, list);
  }, [sb]);

  const refresh = useCallback(async () => {
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (!session) {
      setStatus("signed-out");
      setState(null);
      writeCache(STATE_KEY, null);
      return;
    }
    const meta = session.user.user_metadata as { full_name?: string } | undefined;
    setUserName(meta?.full_name?.split(" ")[0] ?? "");
    const { data, error } = await sb.rpc("maison_state");
    if (error) {
      // Keep what we have (offline, hiccup): the next refresh fixes it.
      setStatus((s) => (s === "loading" && stateRef.current ? "ready" : s));
      return;
    }
    const s = data as GameState | { house: null };
    if (!s.house) {
      setStatus("no-house");
      setState(null);
      writeCache(STATE_KEY, null);
      return;
    }
    const full = s as GameState;
    full.house.credits = Number(full.house.credits);
    full.cards = full.cards.map((c) => ({ ...c, bought_at: Number(c.bought_at) }));
    setState(full);
    setStatus("ready");
    writeCache(STATE_KEY, full);
  }, [sb]);

  // First load + keep fresh when the app comes back to the foreground.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- network fetch, state is set when it answers
    loadMarket();
    refresh();
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") refresh();
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
        loadMarket();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sb, loadMarket, refresh]);

  // Live prices.
  useEffect(() => {
    const channel = sb
      .channel("maison-market")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "maison_trends" }, (payload) => {
        const r = payload.new as TrendRow;
        setMarket((prev) => {
          if (!prev) return prev;
          const next = new Map(prev);
          const old = prev.get(r.id);
          if (r.active === false) {
            next.delete(r.id);
            return next;
          }
          if (!old || (!old.listed && r.listed)) {
            // Newly listed: fetch its real history.
            sb.rpc("maison_history", { p_ids: [r.id], p_days: GAME_CONFIG.market.historyDays }).then(({ data }) => {
              const pts = ((data ?? []) as { points: number[] }[])[0]?.points.map(Number) ?? [];
              setMarket((m) => (m ? new Map(m).set(r.id, toTrend(r, pts)) : m));
            });
            next.set(r.id, toTrend(r, old?.history ?? []));
            return next;
          }
          const value = Number(r.value);
          const history = [...old.history];
          history[history.length - 1] = value;
          next.set(r.id, { ...old, value, dayOpen: Number(r.day_open), source: r.source, updatedAt: r.updated_at, listed: r.listed, history });
          if (value !== old.value) {
            setTicks((t) => ({ ...t, [r.id]: { at: Date.now(), dir: value > old.value ? 1 : -1 } }));
            setTimeout(
              () =>
                setTicks((t) => {
                  const rest = { ...t };
                  delete rest[r.id];
                  return rest;
                }),
              3000,
            );
          }
          return next;
        });
      })
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [sb]);

  const worth = useMemo(() => {
    if (!state) return 0;
    return state.house.credits + state.cards.reduce((s, c) => s + cardWorth(market?.get(c.trend_id)?.value ?? c.bought_at, c.rarity), 0);
  }, [state, market]);

  const patch = (fn: (s: GameState) => GameState) =>
    setState((s) => {
      if (!s) return s;
      const next = fn(s);
      writeCache(STATE_KEY, next);
      return next;
    });

  const openPack: Game["openPack"] = async (paid) => {
    const { data, error } = await sb.rpc(paid ? "maison_buy_pack" : "maison_open_pack");
    if (error || !data) return { error: friendly(error?.message ?? "") };
    const cards = (data as OwnedCard[]).map((c) => ({ ...c, bought_at: Number(c.bought_at) }));
    const today = stateRef.current?.today ?? new Date().toISOString().slice(0, 10);
    patch((s) => {
      const archive = { ...s.archive };
      for (const c of cards) {
        const prev = archive[c.trend_id];
        const rank = (r: string) => ["common", "rare", "epic", "legendary"].indexOf(r);
        archive[c.trend_id] = { r: prev && rank(prev.r) >= rank(c.rarity) ? prev.r : c.rarity, n: (prev?.n ?? 0) + 1 };
      }
      return {
        ...s,
        cards: [...cards, ...s.cards],
        archive,
        house: paid
          ? { ...s.house, credits: s.house.credits - GAME_CONFIG.pack.extraPackCredits }
          : { ...s.house, last_pack_day: today, streak: s.house.last_pack_day === prevDay(today) ? s.house.streak + 1 : 1 },
      };
    });
    refresh();
    return { cards };
  };

  const buy: Game["buy"] = async (trendId) => {
    const t = market?.get(trendId);
    const s = stateRef.current;
    if (!t || !s) return "Not available.";
    const price = cardWorth(t.value, "common");
    if (s.house.credits < price) return ERRORS.not_enough_credits;
    const temp: OwnedCard = {
      id: `pending-${Date.now()}`,
      trend_id: trendId,
      rarity: "common",
      serial: 0,
      bought_at: t.value,
      pulled_at: new Date().toISOString(),
      origin: "buy",
    };
    patch((st) => ({ ...st, cards: [temp, ...st.cards], house: { ...st.house, credits: st.house.credits - price } }));
    const { data, error } = await sb.rpc("maison_buy_trend", { p_trend: trendId });
    if (error || !data) {
      patch((st) => ({ ...st, cards: st.cards.filter((c) => c.id !== temp.id), house: { ...st.house, credits: st.house.credits + price } }));
      return friendly(error?.message ?? "");
    }
    const card = data as OwnedCard;
    patch((st) => ({ ...st, cards: st.cards.map((c) => (c.id === temp.id ? { ...card, bought_at: Number(card.bought_at) } : c)) }));
    refresh();
    return null;
  };

  const sell: Game["sell"] = async (cardId) => {
    const s = stateRef.current;
    const card = s?.cards.find((c) => c.id === cardId);
    if (!s || !card || cardId.startsWith("pending")) return "Not available.";
    const pay = sellPrice(market?.get(card.trend_id)?.value ?? card.bought_at, card.rarity);
    patch((st) => ({ ...st, cards: st.cards.filter((c) => c.id !== cardId), house: { ...st.house, credits: st.house.credits + pay } }));
    const { error } = await sb.rpc("maison_sell_card", { p_card: cardId });
    if (error) {
      refresh();
      return friendly(error.message);
    }
    refresh();
    return null;
  };

  const call: Game["call"] = async (trendId, dir) => {
    const t = market?.get(trendId);
    const at = t?.value ?? 0;
    patch((st) => ({
      ...st,
      forecast: st.forecast.map((f) =>
        f.trend_id === trendId ? { ...f, dir, at, up: f.up + (dir === 1 ? 1 : 0), down: f.down + (dir === -1 ? 1 : 0) } : f,
      ),
    }));
    const { error } = await sb.rpc("maison_call", { p_trend: trendId, p_dir: dir });
    if (error) {
      refresh();
      return friendly(error.message);
    }
    refresh();
    return null;
  };

  const markRead = () => {
    patch((st) => ({ ...st, notes: [] }));
    sb.rpc("maison_mark_read");
  };

  const signOut = async () => {
    await sb.auth.signOut();
    writeCache(STATE_KEY, null);
    setState(null);
    setStatus("signed-out");
  };

  const value: Game = {
    status,
    market,
    state,
    worth,
    ticks,
    userName,
    refresh,
    openPack,
    buy,
    sell,
    call,
    markRead,
    signOut,
    sheet,
    openSheet: (trendId, cardId) => setSheet({ trendId, cardId }),
    closeSheet: () => setSheet(null),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function prevDay(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function useGame() {
  const g = useContext(Ctx);
  if (!g) throw new Error("useGame outside GameProvider");
  return g;
}

/** Listed trends, as an array. */
export function useListed() {
  const { market } = useGame();
  return useMemo(() => (market ? [...market.values()].filter((t) => t.listed) : []), [market]);
}

/** A trend drawn as a card (market view), or an owned card at the live price. */
export function trendCard(t: Trend, card?: OwnedCard): CardView {
  return {
    id: card?.id,
    trendId: t.id,
    name: t.name,
    family: t.family,
    style: t.style,
    rarity: card?.rarity ?? "common",
    serial: card?.serial ?? 0,
    value: t.value,
    dayOpen: t.dayOpen,
    boughtAt: card?.bought_at,
    history: t.history,
  };
}
