import type { Rarity } from "@/config/game";
import type { Family } from "@/lib/cards/families";
import type { TrendStyle } from "@/lib/cards/view";

export interface Trend {
  id: string;
  name: string;
  family: Family;
  style: TrendStyle;
  value: number;
  dayOpen: number;
  source: string;
  updatedAt: string;
  listed: boolean;
  /** Daily closes, oldest first; the last point is the live price. */
  history: number[];
}

export interface House {
  user_id: string;
  name: string;
  monogram: string;
  palette: string[];
  manifesto: string;
  credits: number;
  streak: number;
  last_pack_day: string | null;
  calls_won: number;
  calls_total: number;
}

export interface Season {
  id: number;
  starts_at: string;
  ends_at: string;
}

export interface OwnedCard {
  id: string;
  trend_id: string;
  rarity: Rarity;
  serial: number;
  bought_at: number;
  pulled_at: string;
  origin: "pack" | "buy";
}

export interface ForecastItem {
  trend_id: string;
  open: number;
  dir: 1 | -1 | null;
  at: number | null;
  up: number;
  down: number;
}

export interface Call {
  trend_id: string;
  day: string;
  dir: 1 | -1;
  at: number;
  created_at: string;
  result: "win" | "loss" | "push" | null;
  close: number | null;
  paid: number;
}

export interface Note {
  id: number;
  kind: string;
  body: string;
  created_at: string;
}

export interface GameState {
  house: House;
  season: Season;
  today: string;
  worth: number;
  rank: number;
  players: number;
  admin: boolean;
  cards: OwnedCard[];
  archive: Record<string, { r: Rarity; n: number }>;
  forecast: ForecastItem[];
  calls: Call[];
  notes: Note[];
  series: number[];
  trophies: { season: number; rank: number; worth: number }[];
}
