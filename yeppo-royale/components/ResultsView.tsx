"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Codename } from "@/lib/codename";
import { ordinal, signed, sol } from "@/lib/format";
import { level, tier } from "@/lib/rank";
import { SITE_URL } from "@/lib/config";
import type { MatchInfo, Results } from "@/lib/types";
import Avatar from "./Avatar";

const OUTCOME: Record<string, { label: string; cls: string }> = {
  runner: { label: "Runner", cls: "t-up" },
  rug: { label: "Rug pull", cls: "t-down" },
  pump: { label: "Pump & dump", cls: "t-warn" },
  bleed: { label: "Bled out", cls: "t-down" },
  mid: { label: "Chop", cls: "muted" },
};

export default function ResultsView({
  results,
  info,
  names,
  onWatch,
  onAgain,
}: {
  results: Results;
  info: MatchInfo;
  names: Map<number, Codename>;
  onWatch?: () => void;
  onAgain: () => void;
}) {
  const win = results.place === 1;
  const pnl = (results.final_eq ?? info.start_sol) - info.start_sol;
  const lvAfter = level(results.user?.xp ?? 0);
  const lvBefore = level((results.user?.xp ?? 0) - (results.xp_gain ?? 0));
  const t = tier(results.user?.rp ?? 0);
  const [bar, setBar] = useState(lvBefore.lvl === lvAfter.lvl ? lvBefore.pct : 0);
  useEffect(() => {
    const id = setTimeout(() => setBar(lvAfter.pct), 400);
    return () => clearTimeout(id);
  }, [lvAfter.pct]);
  const share = `I finished ${ordinal(results.place)} of ${results.size} in yeppo royale, the trading battle royale on real pump.fun launches. ${signed(pnl, 2)} SOL. Can you beat me?`;

  return (
    <div className="results">
      <div className="results-inner">
        <div className="results-hero">
          <span className="lbl">{info.mode_name}</span>
          <div className={`place display ${win ? "win" : ""}`}>{win ? "#1" : `#${results.place}`}</div>
          <h2 className="display">{win ? "Last trader standing" : results.survived >= results.cuts ? "Survived every cut" : `Eliminated at cut ${results.survived + 1}`}</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            {ordinal(results.place)} of {results.size} · survived {results.survived}/{results.cuts} cuts · {results.trades} trades
          </p>
        </div>

        <div className="rewards">
          <div className="reward">
            <span className="lbl">Final bag</span>
            <b className={`display mono ${pnl >= 0 ? "t-up" : "t-down"}`}>{sol(results.final_eq ?? info.start_sol)} SOL</b>
            <span className="mono small muted">{signed(pnl, 2)} SOL</span>
          </div>
          <div className="reward">
            <span className="lbl">XP earned</span>
            <b className="display mono t-gold">+{results.xp_gain ?? 0}</b>
            <div className="bar" style={{ marginTop: 8 }}>
              <i style={{ width: `${bar}%` }} />
            </div>
            <span className="small muted">
              Level {lvAfter.lvl}
              {lvAfter.lvl > lvBefore.lvl && <b className="t-gold"> · LEVEL UP!</b>}
            </span>
          </div>
          <div className="reward">
            <span className="lbl">Rank points</span>
            <b className={`display mono ${(results.rp_gain ?? 0) >= 0 ? "t-up" : "t-down"}`}>{signed(results.rp_gain ?? 0, 0)}</b>
            <span className="small" style={{ color: t.color }}>
              {t.name} · {results.user?.rp ?? 0} RP
            </span>
          </div>
        </div>

        <div className="panel-head">
          <span className="lbl">The reveal: what you were really trading</span>
        </div>
        <div className="reveal">
          {results.coins.map((c, i) => {
            const nm = names.get(c.ci);
            const o = OUTCOME[c.outcome ?? "mid"] ?? OUTCOME.mid;
            return (
              <div key={c.ci} className="reveal-card" style={{ animationDelay: `${0.15 * i}s` }}>
                <div className="coin-ico" style={{ background: `hsl(${nm?.hue ?? 200} 70% 22%)` }}>
                  {nm?.emoji}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="small dim">${nm?.ticker} was really</div>
                  <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name ? `${c.name} ($${c.symbol})` : "a real pump.fun coin"}
                  </b>
                  <span className="small muted">
                    {c.stats?.note ??
                      (c.stats?.x_peak ? `peaked at ${c.stats.x_peak.toFixed(1)}x` : "")}
                  </span>
                  {c.mint && (
                    <a className="small t-gold" href={`https://pump.fun/coin/${c.mint}`} target="_blank" rel="noreferrer" style={{ display: "block" }}>
                      View on pump.fun ↗
                    </a>
                  )}
                </div>
                <span className={`outcome ${o.cls}`}>{o.label}</span>
              </div>
            );
          })}
        </div>

        {results.top && results.top.length > 0 && (
          <>
            <div className="panel-head" style={{ marginTop: 24 }}>
              <span className="lbl">Top 5</span>
            </div>
            <div className="panel standings">
              {results.top.map((r) => (
                <div key={r[0]} className="row">
                  <span className="mono dim">#{r[0]}</span>
                  <Avatar look={r[2]} size={26} />
                  <span className="nm">
                    {r[1]}
                    {r[3] && <span className="chip chip-ai">AI</span>}
                  </span>
                  <span className="mono">{sol(r[4])}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="results-actions">
          <button className="btn btn-gold" onClick={onAgain}>
            Play again
          </button>
          {onWatch && (
            <button className="btn" onClick={onWatch}>
              Keep watching
            </button>
          )}
          <a
            className="btn"
            href={`https://x.com/intent/post?text=${encodeURIComponent(share)}&url=${encodeURIComponent(SITE_URL)}`}
            target="_blank"
            rel="noreferrer"
          >
            Share on 𝕏
          </a>
          <Link href="/" className="btn btn-ghost">
            Lobby
          </Link>
        </div>
      </div>
    </div>
  );
}
