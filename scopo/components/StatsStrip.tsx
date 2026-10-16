"use client";

import { dayKey, levelFor, liveStreak } from "@/lib/xp";
import { useStats } from "./stats";

/** Serie, XP e livello: la ricompensa sempre in vista. */
export function StatsStrip() {
  const stats = useStats();
  if (!stats) return <div className="stats-strip is-loading" aria-hidden />;
  const level = levelFor(stats.xp);
  const streak = liveStreak(stats, dayKey(new Date()));
  return (
    <section className="stats-strip" aria-label="Your progress">
      <div className={`stat stat-streak ${streak > 0 ? "is-on" : ""}`}>
        <span className="stat-icon" aria-hidden>
          🔥
        </span>
        <span className="stat-num">{streak}</span>
        <span className="stat-label">day streak</span>
      </div>
      <div className="stat stat-xp">
        <span className="stat-icon" aria-hidden>
          ⚡
        </span>
        <span className="stat-num">{stats.xp}</span>
        <span className="stat-label">XP</span>
      </div>
      <div className="stat stat-level">
        <span className="stat-num">LVL {level.level}</span>
        <span className="stat-label">{level.title}</span>
        <span className="lvl-bar" aria-label={`${level.into} of ${level.span} XP to the next level`}>
          <span style={{ width: `${level.ratio * 100}%` }} />
        </span>
      </div>
    </section>
  );
}
