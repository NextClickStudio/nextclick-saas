// Levels from XP, tiers from rank points.

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
  { name: "Bronze", min: 0, color: "#cd7f32" },
  { name: "Silver", min: 300, color: "#c0c7d4" },
  { name: "Gold", min: 800, color: "#ffd400" },
  { name: "Platinum", min: 1600, color: "#5ee6d1" },
  { name: "Diamond", min: 3000, color: "#62a8ff" },
  { name: "Champion", min: 5000, color: "#ff5fa8" },
  { name: "Legend", min: 8000, color: "#ff8a00" },
];

export function tier(rp: number) {
  let i = 0;
  while (i + 1 < TIERS.length && rp >= TIERS[i + 1].min) i++;
  const t = TIERS[i];
  const next = TIERS[i + 1] ?? null;
  return { ...t, index: i, next, pct: next ? ((rp - t.min) / (next.min - t.min)) * 100 : 100 };
}
