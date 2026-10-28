export type RoomKind = "quick" | "official" | "private";

export type Room = {
  id: string;
  code: string;
  name: string;
  kind: RoomKind;
  prize_sol: number;
  prize_note: string | null;
  max_players: number;
  start_balance: number;
  starts_at: string;
  ends_at: string;
  finalized: boolean;
  created_at: string;
  players?: number;
};

export type Position = { qty: number; cost: number; symbol: string; image: string | null };

export type Player = {
  id: string;
  room_id: string;
  nickname: string;
  color: string;
  cash: number;
  positions: Record<string, Position>;
  realized: number;
  trades_count: number;
  final_equity: number | null;
  final_rank: number | null;
  joined_at: string;
  updated_at: string;
};

export type Trade = {
  id: number;
  room_id: string;
  player_id: string;
  nickname: string;
  color: string | null;
  side: "buy" | "sell";
  mint: string;
  symbol: string | null;
  image: string | null;
  sol: number;
  tokens: number;
  price_sol: number;
  mcap_usd: number | null;
  pnl_sol: number | null;
  created_at: string;
};

export type Fill = {
  side: "buy" | "sell";
  mint: string;
  symbol: string;
  image: string | null;
  sol: number;
  tokens: number;
  price_sol: number;
  mcap_usd: number;
  pnl_sol: number | null;
};

export type Session = { playerId: string; secret: string; nickname: string };

export type RoomStatus = "upcoming" | "live" | "ended";

export function roomStatus(room: Pick<Room, "starts_at" | "ends_at">, now: number): RoomStatus {
  if (now < Date.parse(room.starts_at)) return "upcoming";
  if (now < Date.parse(room.ends_at)) return "live";
  return "ended";
}
