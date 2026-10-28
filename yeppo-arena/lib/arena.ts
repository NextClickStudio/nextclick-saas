import { sellValue, type Coin } from "./market";
import type { Player } from "./types";

/** Liquidation value: what the player would really get selling everything now. */
export function equityOf(p: Player, coins: Record<string, Coin>) {
  let eq = +p.cash;
  for (const [mint, pos] of Object.entries(p.positions ?? {})) {
    const c = coins[mint];
    eq += c ? sellValue(c, +pos.qty) : +pos.cost;
  }
  return eq;
}

export type Ranked = { player: Player; equity: number; pnlPct: number; rank: number };

export function rankPlayers(players: Player[], coins: Record<string, Coin>, startBalance: number, finalized: boolean): Ranked[] {
  const rows = players.map((player) => {
    const equity = finalized && player.final_equity != null ? +player.final_equity : equityOf(player, coins);
    return { player, equity, pnlPct: (equity / startBalance - 1) * 100, rank: 0 };
  });
  if (finalized) rows.sort((a, b) => (a.player.final_rank ?? 1e9) - (b.player.final_rank ?? 1e9));
  else rows.sort((a, b) => b.equity - a.equity || Date.parse(a.player.joined_at) - Date.parse(b.player.joined_at));
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

export const heldMints = (players: Player[]) => [...new Set(players.flatMap((p) => Object.keys(p.positions ?? {})))];
