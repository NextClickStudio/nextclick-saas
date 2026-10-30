"use client";

// The live radar: the board's coins that pass the scam checks, ranked, with why. Used on the home page and in
// the extension when no coin is open.
import { age, usd } from "@/lib/format";
import { usePoll, useNow, useSol } from "@/lib/hooks";
import type { Radar, RadarCoin } from "@/lib/radar";
import { CoinImg } from "./Bits";

async function getRadar(): Promise<Radar> {
  const r = await fetch("/api/radar");
  const j = (await r.json()) as Radar & { error?: string };
  if (!r.ok || j.error) throw new Error(j.error ?? "The radar is busy");
  return j;
}

const DECIDE = { up: "✅ OK to buy", mid: "⚠️ Risky", down: "⛔ Don't buy", learn: "⏳ Too early" } as const;

export default function RadarBoard({ limit = 10, compact = false }: { limit?: number; compact?: boolean }) {
  const { data, error } = usePoll<Radar>(getRadar, 10_000, "radar");
  const now = useNow(1000);
  const sol = useSol() || 150;
  if (!data)
    return (
      <div className={`rd ${compact ? "rd-compact" : ""}`}>
        <p className="rd-wait">{error ? "The radar is busy, retrying…" : "Scanning pump.fun…"}</p>
      </div>
    );
  const picks = data.picks.slice(0, limit);
  return (
    <div className={`rd ${compact ? "rd-compact" : ""}`}>
      <div className="rd-top">
        <span className="rd-live">
          <i className="dot" /> live · {Math.max(0, Math.round((now - data.now) / 1000))}s ago
        </span>
        <span className="rd-count">
          <b className="mono">{data.scanned}</b> hottest coins scanned · <b className="mono down">{data.rejected.n}</b> thrown out ·{" "}
          <b className="mono up">{data.picks.length}</b> left
        </span>
      </div>
      {data.metas.length > 0 && (
        <div className="rd-metas" title="Words in the names of the last hour's launches, by how much those coins traded">
          <span>Memes being launched now</span>
          {data.metas.slice(0, compact ? 6 : 10).map((m) => (
            <i key={m[0]}>
              {m[0]} <em>×{m[1]}</em>
            </i>
          ))}
        </div>
      )}
      {picks.length ? (
        <ol className="rd-list">
          {picks.map((c, i) => (
            <Row key={c.mint} c={c} rank={i + 1} sol={sol} compact={compact} />
          ))}
        </ol>
      ) : (
        <p className="rd-wait">Nothing passes the scam checks right now. That is an answer too: wait.</p>
      )}
      {!compact && data.rejected.reasons.length > 0 && (
        <div className="rd-out">
          <b>Thrown out right now</b>
          {data.rejected.reasons.map(([why, n]) => (
            <span key={why}>
              <em className="mono">{n}</em> {why}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ c, rank, sol, compact }: { c: RadarCoin; rank: number; sol: number; compact: boolean }) {
  const sym = c.symbol ? `$${c.symbol.replace(/^\$/, "").slice(0, 12)}` : c.mint.slice(0, 6);
  return (
    <li className={`rd-row d-${c.decision.tone}`}>
      <span className="rd-rank mono">{rank}</span>
      <CoinImg uri={c.uri} symbol={c.symbol} size={compact ? 30 : 36} />
      <div className="rd-main">
        <div className="rd-name">
          <b>{sym}</b>
          {!compact && c.name && <span className="dim">{c.name.slice(0, 28)}</span>}
          <span className="dim mono">
            {age(c.ageS * 1000)} · {c.mc ? usd(c.mc * sol) : "–"}
          </span>
        </div>
        <div className="rd-chips">
          <span className={`rd-dec d-${c.decision.tone}`}>{DECIDE[c.decision.tone]}</span>
          {c.chips.slice(0, compact ? 2 : 4).map((ch) => (
            <span key={ch.text} className={`rd-chip c-${ch.tone}`}>
              {ch.icon} {ch.text}
            </span>
          ))}
        </div>
        {c.post?.text && !compact && (
          <p className="rd-post">
            <b>@{c.post.handle}</b> {c.post.text}
          </p>
        )}
      </div>
      <div className="rd-side">
        <div className="rd-score" title={`momentum ${c.parts.momentum}/40 · attention ${c.parts.attention}/35 · look-alikes ${c.parts.lookalike}/15 · fresh ${c.parts.fresh}/10`}>
          <i style={{ width: `${Math.min(100, c.score)}%` }} />
          <b className="mono">{c.score}</b>
        </div>
        <div className="rd-links">
          <a href={`https://gmgn.ai/sol/token/${c.mint}`} target="_blank" rel="noreferrer">
            GMGN
          </a>
          <a href={`https://pump.fun/coin/${c.mint}`} target="_blank" rel="noreferrer">
            pump
          </a>
          {!compact && (
            <a href={`/c/${c.mint}`} target="_blank" rel="noreferrer">
              scan
            </a>
          )}
        </div>
      </div>
    </li>
  );
}
