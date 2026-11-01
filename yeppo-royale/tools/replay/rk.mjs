// Which ranking picks better coins? Every 2 minutes, rank the coins read in that window that are not Don't buy,
// take the top 3 (first read per coin), and see what they did next. Time-split halves.
import fs from "node:fs";
const tests = JSON.parse(fs.readFileSync("tests.json", "utf8"));
const COST = 0.0175, DEF = { tp: 1.4, stop: 0.75, minutes: 4 };
function trade(path, p) {
  const last = Math.min(29, Math.max(2, Math.round(p.minutes * 3) - 1));
  let r = path[Math.min(last, path.length - 1)];
  for (let i = 0; i <= last && i < path.length; i++) { if (path[i] >= p.tp) { r = p.tp; break; } if (path[i] <= p.stop) { r = path[i]; break; } }
  return r * (1 - COST) * (1 - COST) - 1;
}
const ok = (t) => { const f = t.f; return t.tone !== "rug" && t.tone !== "down" && f[10] < 0.25 && f[9] < 0.05 && f[11] < 0.15 && (f[17] ?? 0) < 0.5 && !t.sig.ladder; };
const S = {
  activity: (t) => t.f[4],
  momentum: (t) => t.f[4] + 2 * (t.f[5] - 0.5) + t.f[6] + 0.5 * t.f[8],
  lookalike: (t) => t.o.p50 - t.o.dump,
  blend: (t) => 0.6 * (t.f[4] + 2 * (t.f[5] - 0.5) + t.f[6] + 0.5 * t.f[8]) / 6 + 0.4 * (t.o.p50 - t.o.dump) * 3,
  random: () => Math.random(),
};
const pick = (part, score, k = 3) => {
  const used = new Set(); const out = [];
  const t0 = part[0].at;
  const by = new Map();
  for (const t of part) { const w = Math.floor((t.at - t0) / 120000); if (!by.has(w)) by.set(w, []); by.get(w).push(t); }
  for (const [, arr] of [...by].sort((a, b) => a[0] - b[0])) {
    const c = arr.filter((t) => ok(t) && !used.has(t.mint)).sort((a, b) => score(b) - score(a)).slice(0, k);
    for (const t of c) { used.add(t.mint); out.push(t); }
  }
  return out;
};
const stat = (l) => { const n = l.length; if (!n) return "n=0"; const nets = l.map((t) => trade(t.fut, t.plan ?? DEF)); const avg = nets.reduce((a, b) => a + b, 0) / n;
  return `n=${n} pump50=${(l.filter((t) => Math.max(...t.fut) >= 1.5).length / n * 100).toFixed(0)}% crash50=${(l.filter((t) => Math.min(...t.fut) <= 0.5).length / n * 100).toFixed(0)}% planWin=${(nets.filter((x) => x > 0).length / n * 100).toFixed(0)}% planAvg=${(avg * 100).toFixed(1)}% hold10=${(l.reduce((a, t) => a + t.fut[29] * (1 - COST) ** 2 - 1, 0) / n * 100).toFixed(1)}%`; };
tests.sort((a, b) => a.at - b.at);
const mid = tests[Math.floor(tests.length / 2)].at;
for (const [name, part] of [["1st half", tests.filter((t) => t.at < mid)], ["2nd half", tests.filter((t) => t.at >= mid)]]) {
  console.log("==", name);
  for (const [k, s] of Object.entries(S)) console.log(k.padEnd(10), stat(pick(part, s)));
}
