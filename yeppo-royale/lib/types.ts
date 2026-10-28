export type User = {
  id: string;
  handle: string;
  avatar: unknown;
  xp: number;
  rp: number;
  matches: number;
  wins: number;
  top5: number;
  cuts_survived: number;
  best_pnl: number;
  created_at: string;
  last_seen: string;
};

export type Session = { secret: string; userId: string; handle: string };

export type Mode = {
  id: string;
  name: string;
  tagline: string;
  size: number;
  dur_ms: number;
  cuts: number;
  next_start: number;
  queued: number;
  live: number;
};

export type Lobby = {
  now: number;
  arenas: number;
  online: number;
  active: { id: string; mode: string; start_at: string } | null;
  modes: Mode[];
};

export type Cut = { at: number; keep: number };

export type MatchCoin = { ci: number; at: number; sol_usd: number | null; x: boolean; tg: boolean; web: boolean };

/** [slot, name, avatar, isBot] */
export type RosterRow = [number, string, unknown, boolean];

export type MatchInfo = {
  id: string;
  mode: string;
  mode_name: string;
  start_at: number;
  server_now: number;
  speed: number;
  size: number;
  dur_ms: number;
  cuts: Cut[];
  start_sol: number;
  me: number | null;
  coins: MatchCoin[];
  roster: RosterRow[] | null;
};

/** [ci, matchMs, seq, wallet, kind(0 create,1 buy,2 sell), sol, tokens, balance, mcSol, vSol] */
export type FeedEv = [number, number, number, number, number, number, number, number | null, number, number | null];

/** [slot, equity, trades, elimCut, place] */
export type BoardRow = [number, number, number, number | null, number | null];
/** [slot, ci, kind, sol, matchMs] */
export type BoardFeed = [number, number, number, number, number];

export type Board = {
  now: number;
  resolved: number;
  finished: boolean;
  alive: number;
  rows: BoardRow[] | null;
  feed: BoardFeed[] | null;
  me?: {
    slot: number;
    cash: number;
    pos: Record<string, number>;
    /** [ci, kind, sol, tokens, matchMs] */
    fills: [number, number, number, number, number][];
  };
};

export type RevealCoin = {
  ci: number;
  name: string | null;
  symbol: string | null;
  mint: string | null;
  outcome: string | null;
  stats: { x_peak?: number; x_final?: number; dev_sold?: number; graduated?: boolean; note?: string } | null;
};

export type Results = {
  pending?: boolean;
  place: number;
  size: number;
  final_eq: number | null;
  survived: number;
  cuts: number;
  xp_gain: number;
  rp_gain: number;
  trades: number;
  finished: boolean;
  user: User;
  coins: RevealCoin[];
  /** [place, name, avatar, isBot, equity] */
  top: [number, string, unknown, boolean, number][] | null;
};
