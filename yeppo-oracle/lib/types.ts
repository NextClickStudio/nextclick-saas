// Shapes returned by the oracle RPCs (see supabase/migrations/012_oracle.sql in yeppo-royale).

export type Odds = { k: number; p2x: number; p50: number; dump: number; end: number; up: number; med: number; best: number; dist: number };
export type Base = { p2x: number; p50: number; dump: number; end: number };
/** [mint, distance, best multiple, worst multiple, multiple every 20 s for 10 min, symbol] */
export type Match = [string, number, number, number, number[], string | null];
export type Oracle =
  | { old?: undefined; cp: number; age_b: number; n: number; f?: number[]; base: Base; odds: Odds; matches?: Match[] }
  | { old: true; age_b: number };
/** [bucket (10 s), close, high, low, buys, sells, SOL bought, SOL sold]; prices are market caps in SOL */
export type Bucket = [number, number, number, number, number, number, number, number];

export type Future =
  | { tracked: false; now: number; recorded: number | null }
  | {
      tracked: true;
      now: number;
      t0: number;
      dev: string | null;
      n: number;
      ath: number;
      recorded: number | null;
      meta: [string | null, string | null, string | null] | null;
      path: Bucket[] | null;
      oracle: Oracle | null;
    };

export type Kind = "dev" | "sniper" | "flipper" | "smart" | "fresh" | "trader";
/** [wallet, supply %, kind, first trade ms, SOL in, SOL out, closed positions, avg hold s, win rate, pnl SOL] */
export type TopRow = [string, number, Kind, number, number, number, number | null, number | null, number | null, number];
export type Xray =
  | { tracked: false; now: number }
  | {
      tracked: true;
      now: number;
      t0: number;
      dev: string | null;
      holders: number;
      traders: number;
      known: number;
      kinds: Partial<Record<Kind, [number, number]>> | null;
      /** [bought %, held %, SOL in, SOL out, sells, last trade ms] */
      devpos: [number, number, number, number, number, number] | null;
      top: TopRow[] | null;
      /** [seconds until the holder's usual exit (negative: overdue), supply %, kind] */
      exit: [number, number, Kind][] | null;
      tags: Record<string, Kind> | null;
      pattern: Pattern | null;
      devhist: DevHist | null;
    };

/** the shape of the last 2 minutes; ladder = a straight climb made of buys (bots) */
export type Pattern = { er: number | null; bshare: number | null; n: number; drift: number | null; cv: number | null; fresh: number | null; ladder: boolean };
/** the creator's record: retired coins yeppo followed, plus their other coins live now */
export type DevHist = { coins: number; rugs: number; grads: number; dead: number; best: number | null; since: number | null; live: number; live_sold: number; live_dead: number };

/** [mint, name, symbol, uri, born ms, mc SOL, ath SOL, trades 2m, buys 2m, SOL 2m, oracle, pattern, dev record] */
export type HotCoin = [
  string, string | null, string | null, string | null, number, number | null, number, number, number, number,
  Oracle | null, (Pattern | null)?, (DevHist | null)?,
];

/** the oracle's record, replayed hourly on past coins it could not have seen the end of */
export type Track = {
  at: number;
  tests: number;
  coins: number;
  calls: { up: number; mid: number; down: number; flat: number };
  up: { n: number; hit50: number | null; higher: number | null; win: number | null; ret: number | null };
  down: { n: number; dump50: number | null; lower: number | null };
  all: { n: number; hit50: number; dump50: number; higher: number; lower: number; win: number; ret: number };
  direction: number | null;
  calib: [number, number, number, number][];
};
export type Hot = { now: number; recorded: number | null; coins: HotCoin[] };

/** [mint, ms, 1 buy | 2 sell, SOL, tokens, virtual SOL, virtual tokens, wallet, signature] */
export type TickRow = [string, number, 1 | 2, number, number, number, number, string, string];

/** [mint, name, symbol, uri, born, supply %, SOL in, SOL out, first trade, last trade, mc SOL, ath SOL,
 *  oracle, pattern, dev record, dev sold, supply % that could sell within 60 s] */
export type Bag = [
  string, string | null, string | null, string | null, number, number, number, number, number, number, number | null, number,
  Oracle | null, Pattern | null, DevHist | null, boolean | null, number,
];
export type Guard = {
  now: number;
  who: string;
  habits: { n: number; hold: number | null; win: number | null; quick: number | null; pnl: number; last: number } | null;
  bags: Bag[];
  /** [mint, symbol, SOL in, SOL out, first trade, last trade] */
  closed: [string, string | null, number, number, number, number][];
};
