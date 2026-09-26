/**
 * Server-side data loading for the game screens.
 */
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GAME_CONFIG, Rarity } from "@/config/game";
import type { Family } from "@/lib/cards/catalog";
import type { CardView, TrendStyle } from "@/lib/cards/view";
import { supabaseServer } from "@/lib/supabase/server";

export interface TrendRow {
  id: string;
  name: string;
  family: Family;
  query: string;
  style: TrendStyle;
  value: number;
  day_open: number;
  source: string;
  updated_at: string;
  active: boolean;
}

export interface CardRow {
  id: string;
  trend_id: string;
  rarity: Rarity;
  serial: number;
  bought_at: number;
  pulled_at: string;
  expires_at: string;
  status: "active" | "sold" | "expired";
  on_runway: boolean;
  closed_at: string | null;
  closed_for: number | null;
}

export interface HouseRow {
  user_id: string;
  name: string;
  monogram: string;
  palette: string[];
  manifesto: string;
  credits: number;
  streak: number;
  last_pack_day: string | null;
  duel_streak: number;
}

export const todayUtc = () => new Date().toISOString().slice(0, 10);

/** Signed-in user + their maison. Redirects when either is missing. */
export async function requireHouse() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: house } = await supabase.from("maison_houses").select("*").eq("user_id", user.id).maybeSingle();
  if (!house) redirect("/onboarding");
  return { supabase, user, house: house as HouseRow };
}

export async function loadTrends(supabase: SupabaseClient, ids?: string[]): Promise<TrendRow[]> {
  let q = supabase.from("maison_trends").select("*").eq("active", true);
  if (ids) q = q.in("id", ids);
  const { data } = await q;
  return ((data ?? []) as TrendRow[]).map((t) => ({ ...t, value: Number(t.value), day_open: Number(t.day_open) }));
}

/** Daily closes for the chart, with today's live value as the last point. */
export async function loadHistories(supabase: SupabaseClient, trends: TrendRow[], days = 30): Promise<Map<string, number[]>> {
  const { data } = await supabase.rpc("maison_history", { p_ids: trends.map((t) => t.id), p_days: days });
  const map = new Map<string, number[]>();
  for (const row of (data ?? []) as { trend_id: string; points: number[] }[]) map.set(row.trend_id, row.points.map(Number));
  for (const t of trends) {
    const h = map.get(t.id) ?? [];
    if (!h.length || h[h.length - 1] !== t.value) h.push(t.value);
    map.set(t.id, h);
  }
  return map;
}

export function toView(card: CardRow, trend: TrendRow, history: number[]): CardView {
  const msLeft = new Date(card.expires_at).getTime() - Date.now();
  return {
    id: card.id,
    trendId: trend.id,
    name: trend.name,
    family: trend.family,
    style: trend.style ?? {},
    rarity: card.rarity,
    serial: card.serial,
    daysLeft: Math.max(0, Math.ceil(msLeft / 86_400_000)),
    value: trend.value,
    dayOpen: trend.day_open,
    boughtAt: Number(card.bought_at),
    history,
    onRunway: card.on_runway,
  };
}

/** A trend shown as a card without owning it (market, intro). */
export function trendView(trend: TrendRow, history: number[], rarity: Rarity = "common"): CardView {
  return {
    trendId: trend.id,
    name: trend.name,
    family: trend.family,
    style: trend.style ?? {},
    rarity,
    serial: 0,
    daysLeft: GAME_CONFIG.cards.lifespanDays,
    value: trend.value,
    dayOpen: trend.day_open,
    boughtAt: trend.value,
    history,
  };
}

/** All active cards of the signed-in player as views. */
export async function loadMyCards(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("maison_cards")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("pulled_at", { ascending: false });
  const cards = (data ?? []) as CardRow[];
  const trends = await loadTrends(supabase, [...new Set(cards.map((c) => c.trend_id))]);
  const byId = new Map(trends.map((t) => [t.id, t]));
  const histories = await loadHistories(supabase, trends);
  const views = cards.filter((c) => byId.has(c.trend_id)).map((c) => toView(c, byId.get(c.trend_id)!, histories.get(c.trend_id) ?? []));
  return { cards, views, trends, histories };
}
