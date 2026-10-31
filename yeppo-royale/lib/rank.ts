// Levels from XP, tiers from duel rating.

export function level(xp: number) {
  // each level needs a bit more: 300, 400, 500, ...
  let lvl = 1;
  let need = 300;
  let left = Math.max(0, xp);
  while (left >= need && lvl < 200) {
    left -= need;
    lvl++;
    need += 100;
  }
  return { lvl, into: left, need, pct: (left / need) * 100 };
}

export const TIERS = [
  { name: "Bronze", min: 0, color: "#c98a5a" },
  { name: "Silver", min: 950, color: "#b9c2cf" },
  { name: "Gold", min: 1100, color: "#f0b90b" },
  { name: "Platinum", min: 1250, color: "#4fd1c5" },
  { name: "Diamond", min: 1400, color: "#5b9dff" },
  { name: "Master", min: 1600, color: "#b18cff" },
  { name: "Legend", min: 1800, color: "#ff5c8a" },
];

export function tier(elo: number) {
  let i = 0;
  while (i + 1 < TIERS.length && elo >= TIERS[i + 1].min) i++;
  const t = TIERS[i];
  const next = TIERS[i + 1] ?? null;
  return { ...t, index: i, next, pct: next ? Math.max(0, Math.min(100, ((elo - t.min) / (next.min - t.min)) * 100)) : 100 };
}
