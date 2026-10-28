"use client";

import type { Ranked } from "@/lib/arena";
import { fmtPct, fmtSol, tone } from "@/lib/format";

const ROW = 34;
const MEDALS = ["🥇", "🥈", "🥉"];

type Props = { ranked: Ranked[]; meId: string | null; maxPlayers: number; finalized: boolean };

export default function Leaderboard({ ranked, meId, maxPlayers, finalized }: Props) {
  return (
    <section className="board">
      <div className="panel-title">
        {finalized ? "Classifica finale" : "Classifica live"}
        <span className="muted mono">
          {ranked.length}/{maxPlayers}
        </span>
      </div>
      {ranked.length ? (
        <div className="board-rows">
          <div className="board-inner" style={{ height: ranked.length * ROW }}>
            {ranked.map((r) => (
              <div
                key={r.player.id}
                className={`board-row ${r.player.id === meId ? "me" : ""} ${r.rank <= 3 ? `top top${r.rank}` : ""}`}
                style={{ transform: `translateY(${(r.rank - 1) * ROW}px)` }}
              >
                <span className="board-rank mono">{r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank}</span>
                <i className="board-dot" style={{ background: r.player.color }} />
                <b className="board-nick">
                  {r.player.nickname}
                  {r.player.id === meId && <em>TU</em>}
                </b>
                <span className="board-eq mono">{fmtSol(r.equity)}</span>
                <span className={`board-pnl mono t-${tone(r.pnlPct)}`}>{fmtPct(r.pnlPct)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rows-empty muted">Nessuno in gara. Sii il primo!</div>
      )}
    </section>
  );
}
