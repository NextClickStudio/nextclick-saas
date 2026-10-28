"use client";

import { fmtAge, fmtSol, fmtUsd, tone } from "@/lib/format";
import type { Trade } from "@/lib/types";

type Props = { trades: Trade[]; meId: string | null; now: number; onSelect: (mint: string) => void };

export default function Feed({ trades, meId, now, onSelect }: Props) {
  return (
    <section className="feed">
      <div className="panel-title">
        Trade della stanza <i className="live-dot" />
      </div>
      {trades.length ? (
        <div className="feed-rows">
          {trades.map((t) => {
            const pnl = t.pnl_sol != null ? +t.pnl_sol : null;
            return (
              <div key={t.id} className={`feed-row ${t.side} ${+t.sol >= 2 ? "whale" : ""} ${t.player_id === meId ? "mine" : ""}`}>
                <i className="board-dot" style={{ background: t.color ?? "#888" }} />
                <span className="feed-text">
                  <b>{t.nickname}</b> {t.side === "buy" ? "compra" : "vende"}{" "}
                  <span className="mono">{fmtSol(+t.sol)}</span>{" "}
                  <button className="feed-sym" onClick={() => onSelect(t.mint)}>
                    ${t.symbol}
                  </button>{" "}
                  <span className="muted mono">@{fmtUsd(t.mcap_usd != null ? +t.mcap_usd : null)}</span>
                  {pnl != null && <span className={`mono t-${tone(pnl)}`}> {fmtSol(pnl, true)}</span>}
                  {+t.sol >= 2 && " 🐋"}
                </span>
                <time className="muted mono">{fmtAge(now - Date.parse(t.created_at))}</time>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rows-empty muted">Ancora nessun trade. Rompi il ghiaccio 🧊</div>
      )}
    </section>
  );
}
