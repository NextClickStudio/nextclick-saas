// The new decision (OK to buy / Risky / Don't buy) on every replayed read, first time per coin, by time half.
import fs from "node:fs";
const tests = JSON.parse(fs.readFileSync("tests.json", "utf8"));
const COST = 0.0175, DEF = { tp: 1.4, stop: 0.75, minutes: 4 };
function trade(path, p) {
  const last = Math.min(29, Math.max(2, Math.round(p.minutes * 3) - 1));
  let r = path[Math.min(last, path.length - 1)];
  for (let i = 0; i <= last && i < path.length; i++) { if (path[i] >= p.tp) { r = p.tp; break; } if (path[i] <= p.stop) { r = path[i]; break; } }
  return r * (1 - COST) * (1 - COST) - 1;
}
const dec = (t) => {
  const f = t.f;
  const ok = f[10] < 0.25 && f[9] < 0.05 && f[11] < 0.15 && (f[17] ?? 0) < 0.5 && !t.sig.ladder;
  if (t.tone === "rug" || t.tone === "down" || !ok) return "no";
  return t.tone === "up" ? "yes" : "risky";
};
const mid = tests[Math.floor(tests.length / 2)].at;
for (const [name, part] of [["all", tests], ["1st half", tests.filter((t) => t.at < mid)], ["2nd half", tests.filter((t) => t.at >= mid)]]) {
  const seen = new Set(); const first = part.filter((t) => !seen.has(t.mint) && seen.add(t.mint));
  console.log(`== ${name}: ${first.length} coins`);
  for (const d of ["yes", "risky", "no"]) {
    const l = first.filter((t) => dec(t) === d); const n = l.length; if (!n) { console.log(d, 0); continue; }
    const fell = l.filter((t) => Math.min(...t.fut) <= 0.5).length / n, rose = l.filter((t) => Math.max(...t.fut) >= 1.5).length / n;
    const nets = l.map((t) => trade(t.fut, t.plan ?? DEF)); const avg = nets.reduce((a, b) => a + b, 0) / n, win = nets.filter((x) => x > 0).length / n;
    console.log(d.padEnd(6), `n=${n} share=${(n / first.length * 100).toFixed(0)}% crash50=${(fell * 100).toFixed(0)}% pump50=${(rose * 100).toFixed(0)}% planWin=${(win * 100).toFixed(0)}% planAvg=${(avg * 100).toFixed(1)}%`);
  }
}
