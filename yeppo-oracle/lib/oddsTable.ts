// The odds table (yr_odds, ~250 rows rebuilt each night), kept 30 minutes on each server: no database work per read.
import { DB_HEADERS } from "./access";
import { SUPABASE_URL } from "./config";
import type { OddsRow } from "./odds";

let rows: OddsRow[] = [];
let at = 0;
export async function oddsTable(): Promise<OddsRow[]> {
  if (Date.now() - at < 30 * 60_000) return rows;
  at = Date.now(); // one fetch at a time; a failure keeps the old table and tries again in 30 minutes
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_odds_s`, { method: "POST", headers: DB_HEADERS, body: "{}", signal: AbortSignal.timeout(3000) });
    if (r.ok) rows = (await r.json()) as OddsRow[];
  } catch {
    /* keep the old table */
  }
  return rows;
}
