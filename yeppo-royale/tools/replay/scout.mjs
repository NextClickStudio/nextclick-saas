// The expert checklist ("scout") on yeppo's own snapshots, with what really came next.
// Every rule only uses what was known at the snapshot. Trades: Exit Plan levels, 1.75% a side.
import fs from "node:fs";
const tests = JSON.parse(fs.readFileSync("tests.json", "utf8"));
const COST = 0.0175, DEF = { tp: 1.4, stop: 0.75, minutes: 4 };
const q = (s, p) => { if (!s.length) return NaN; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
function trade(path, p) {
  const last = p ? Math.min(29, Math.max(2, Math.round(p.minutes * 3) - 1)) : 29;
  let r = path[Math.min(last, path.length - 1)];
  if (p) for (let i = 0; i <= last && i < path.length; i++) { if (path[i] >= p.tp) { r = p.tp; break; } if (path[i] <= p.stop) { r = path[i]; break; } }
  return r * (1 - COST) * (1 - COST) - 1;
}
const E = Math.exp;
const R = {
  top10: (f) => f[10] < 0.25,
  dev: (f) => f[9] < 0.05,
  snipers: (f) => f[11] < 0.15,
  devHolds: (f) => f[16] < 0.5,
  cleanDev: (f) => (f[17] ?? 0) < 0.5,
  noLadder: (f, t) => !t.sig.ladder,
  active20: (f) => E(f[4]) - 1 >= 20,
  holders40: (f) => E(f[8]) - 1 >= 40,
  buys55: (f) => f[5] >= 0.55,
  inflow: (f) => f[6] > 0,
  mc40: (f) => 27.96 * E(f[0]) >= 40,
  noSpike: (f) => f[2] < Math.log(1.5),
  notFresh: (f) => f[14] < 0.6,
  nearHigh: (f) => f[3] < Math.log(1.5),
};
const first = (list) => { const seen = new Set(); return list.filter((t) => !seen.has(t.mint) && seen.add(t.mint)); };
function line(name, list, planOf = (t) => t.plan ?? DEF) {
  list = first(list);
  const n = list.length; if (!n) return console.log(name.padEnd(30), "n=0");
  const nets = list.map((t) => trade(t.fut, planOf(t))).sort((a, b) => a - b);
  const avg = nets.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(nets.reduce((a, b) => a + (b - avg) ** 2, 0) / n);
  const win = nets.filter((x) => x > 0).length / n;
  const fell = list.filter((t) => Math.min(...t.fut) <= 0.5).length / n, rose = list.filter((t) => Math.max(...t.fut) >= 1.5).length / n;
  console.log(name.padEnd(30), `n=${String(n).padStart(4)} win ${(win * 100).toFixed(0).padStart(3)}% avg ${(avg * 100).toFixed(1).padStart(6)}% ±${(196 * sd / Math.sqrt(n)).toFixed(1).padStart(4)} med ${(q(nets, 0.5) * 100).toFixed(1).padStart(6)}%  fell50 ${(fell * 100).toFixed(0).padStart(3)}%  rose50 ${(rose * 100).toFixed(0).padStart(3)}%`);
  return { n, win, avg };
}
const dist = (j) => { const v = tests.map((t) => t.f[j]).filter((x) => x != null).sort((a, b) => a - b); return [0.1, 0.25, 0.5, 0.75, 0.9].map((p) => q(v, p).toFixed(3)).join(" "); };
console.log("tests", tests.length, "coins", new Set(tests.map((t) => t.mint)).size, "hours", ((tests.at(-1).at - tests[0].at) / 3.6e6).toFixed(1));
for (const [j, n] of [[9, "dev"], [10, "top10"], [11, "snipers"], [14, "fresh"], [16, "devSold"], [17, "devRug"]]) console.log(`  dist ${n.padEnd(8)} ${dist(j)}`);
console.log("\n— one rule at a time (first time each coin passes) —");
line("baseline: every coin", tests);
for (const [k, fn] of Object.entries(R)) { line(`  ${k}`, tests.filter((t) => fn(t.f, t))); line(`  NOT ${k}`, tests.filter((t) => !fn(t.f, t))); }
const all = (keys) => (t) => keys.every((k) => R[k](t.f, t));
const SAFE = ["top10", "dev", "snipers", "cleanDev", "noLadder"];
const ACTIVE = ["active20", "holders40", "buys55", "noSpike"];
const FULL = [...SAFE, ...ACTIVE, "mc40"];
console.log("\n— checklists —");
line("safety checks (5)", tests.filter(all(SAFE)));
line("activity floors (4)", tests.filter(all(ACTIVE)));
line("full expert checklist", tests.filter(all(FULL)));
line("yeppo Runner", tests.filter((t) => t.tone === "up"));
line("yeppo Runner + plan go", tests.filter((t) => t.tone === "up" && t.plan?.go));
line("checklist + yeppo Runner", tests.filter((t) => all(FULL)(t) && t.tone === "up"));
line("safety + yeppo Runner", tests.filter((t) => all(SAFE)(t) && t.tone === "up"));
line("safety + not dump/rug", tests.filter((t) => all(SAFE)(t) && t.tone !== "down" && t.tone !== "rug"));
line("checklist, not dump/rug", tests.filter((t) => all(FULL)(t) && t.tone !== "down" && t.tone !== "rug"));
console.log("\n— the same, held 10 min with no plan —");
for (const [n, fn] of [["every coin", () => true], ["full checklist", all(FULL)], ["checklist + Runner", (t) => all(FULL)(t) && t.tone === "up"]]) line(n, tests.filter(fn), () => null);
fs.writeFileSync("rules.json", JSON.stringify({ SAFE, ACTIVE, FULL }));
// greedy search on the first half only, checked on the second half (no peeking)
const mid = tests[Math.floor(tests.length / 2)].at;
const A = tests.filter((t) => t.at < mid), B = tests.filter((t) => t.at >= mid);
const score = (list) => { const l = first(list); if (l.length < 15) return -1; const nets = l.map((t) => trade(t.fut, t.plan ?? DEF)); return nets.reduce((a, b) => a + b, 0) / l.length; };
let pick = [], best = score(A);
for (let step = 0; step < 5; step++) {
  let bk = null;
  for (const k of Object.keys(R)) { if (pick.includes(k)) continue; const s = score(A.filter(all([...pick, k]))); if (s > best + 0.005) [best, bk] = [s, k]; }
  if (!bk) break; pick.push(bk);
}
console.log("\n— rules picked on the first half:", pick.join(", ") || "(none)", "—");
line("first half (picked on)", A.filter(all(pick)));
line("second half (unseen)", B.filter(all(pick)));
line("second half, every coin", B);
