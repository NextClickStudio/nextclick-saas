export type User = {
  id: string;
  handle: string;
  avatar: unknown;
  xp: number;
  elo: number;
  d_played: number;
  d_won: number;
  d_lost: number;
  streak: number;
  best_streak: number;
  r_played: number;
  r_won: number;
  best_roi: number | null;
  wallet: string | null;
  created_at: string;
  last_seen: string;
};

export type Session = { secret: string; userId: string; handle: string };

// ---------- practice duels ----------

export type DuelPlayer = { name: string; avatar: unknown; elo: number; w?: number; l?: number; streak?: number; verified?: boolean };

export type RoundReveal = { name: string | null; symbol: string | null; outcome: string | null; note: string | null; x_peak: number | null; mint: string };

export type DuelRound = {
  r: number;
  off: number;
  sol_usd: number | null;
  x: boolean;
  tg: boolean;
  web: boolean;
  /** wallet index of the real trader the ghost replays */
  gw: number | null;
  gs: number | null;
  eq1: number | null;
  eq2: number | null;
  n1: number | null;
  n2: number | null;
  win: number | null;
  reveal: RoundReveal | null;
};

/** [slot, round, msIntoRound, kind(1 buy, 2 sell), sol, tokens] */
export type DuelFill = [number, number, number, number, number, number];

export type DuelState = {
  id: string;
  status: "queue" | "live" | "done" | "cancelled";
  now: number;
  created: number;
  start: number | null;
  round_ms: number;
  gap_ms: number;
  speed: number;
  rounds: number;
  me: 1 | 2 | null;
  ghost: boolean;
  p1: DuelPlayer;
  p2: DuelPlayer | null;
  score: [number | null, number | null];
  winner: number | null;
  elo: [number | null, number | null];
  rs: DuelRound[];
  fills: DuelFill[];
  /** [slot, emote, atMs] */
  emotes: [number, number, number][];
};

/** [coinMs, seq, wallet, kind(0 create, 1 buy, 2 sell), sol, tokens, balance, mcSol, vSol] */
export type FeedRow = [number, number, number, number, number, number, number | null, number, number | null];

export type RecentDuel = {
  id: string;
  ended: number;
  s1: number | null;
  s2: number | null;
  winner: number | null;
  elo1: number | null;
  elo2: number | null;
  n1: string;
  a1: unknown;
  n2: string;
  a2: unknown;
  ghost: boolean;
};

export type Arena = {
  now: number;
  online: number;
  queue: number;
  live: number;
  today: number;
  pool: number;
  active: { id: string; status: string } | null;
  recent: RecentDuel[];
  top: { name: string; avatar: unknown; elo: number; w: number; l: number }[];
  /** coins: [name, symbol, ageMs, mcUsd, events] */
  pulse: { launches: number; trades: number; coins: [string, string, number, number, number][] };
};

// ---------- real duels ----------

export type RealPlayer = { name: string; avatar: unknown; elo: number; wallet: string; rw: number; rp: number };
export type RealScore = { vol: number; pnl: number; roi: number | null; n: number };

export type RealDuel = {
  id: string;
  code: string;
  status: "open" | "live" | "done" | "cancelled" | "expired";
  now: number;
  created: number;
  start: number | null;
  end: number | null;
  dur_ms: number;
  me: 1 | 2 | null;
  winner: number | null;
  elo: [number | null, number | null];
  p1: RealPlayer;
  p2: RealPlayer | null;
  score: [RealScore | null, RealScore | null] | null;
  polled: Record<string, number> | null;
  /** [slot, mint, kind, sol, tokens, atMs, signature] */
  trades: [number, string, number, number, number, number, string][];
  mints: Record<string, { px: number | null; name: string | null; symbol: string | null }>;
};

export type RealBoard = {
  now: number;
  mine: { code: string; status: string } | null;
  open: { code: string; name: string; avatar: unknown; elo: number; rw: number; rp: number; dur_ms: number; created: number }[];
  live: { code: string; n1: string; a1: unknown; n2: string; a2: unknown; start: number; end: number }[];
  recent: { code: string; n1: string; a1: unknown; n2: string; a2: unknown; winner: number; r1: number | null; r2: number | null; end_ms: number }[];
};
