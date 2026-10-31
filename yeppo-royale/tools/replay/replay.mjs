// Replays yeppo's calls on every finished snapshot, using only what was known at the time
// (training snapshots older than the test by 10 minutes), then trades each call with its Exit Plan on the
// coin's real next 10 minutes (20 s closes), with 1.75% cost a side, like the paper wallet.
import fs from "node:fs";
const rows = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).map((r) => ({ ...r, at: Number(r.at), f: r.f.map((x) => (x == null ? null : Number(x))), fut: r.fut.map(Number) }));
const COST = 0.0175;
const K = 30;
const W = [1.3, 1, 1, 0.8, 1, 0.5, 0.5, 0.6, 0.8, 0.5, 0.6, 0.5, 1, 1, 0.6, 0.6, 0.8, 0.8];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const q = (s, p) => { if (!s.length) return 1; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// --- the site's logic, copied from lib/oracle.ts ---
function plan(paths) {
  paths = paths.filter((p) => p.length >= 10);
  if (paths.length < 10) return null;
  const peaks = paths.map((p) => { let mx = 1, at = 0; p.forEach((v, i) => { if (v > mx) [mx, at] = [v, i]; }); return { mx, at }; });
  let stop = 0.6;
  for (const s of [0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6]) {
    const hit = paths.filter((p) => p.some((v) => v <= s));
    if (hit.length < 3) continue;
    const came = hit.filter((p) => p.slice(p.findIndex((v) => v <= s)).some((v) => v >= 1.05)).length;
    if (came / hit.length <= 0.2) { stop = s; break; }
  }
  const ups = peaks.filter((x) => x.mx >= 1.25);
  const tp = ups.length >= 3 ? clamp(q(ups.map((x) => x.mx).sort((a, b) => a - b), 0.4), 1.2, 3) : 1.3;
  const atQ = ups.length ? q(ups.map((x) => x.at).sort((a, b) => a - b), 0.6) : 14;
  const last = Math.min(29, Math.max(2, Math.round(atQ) + 1));
  let wins = 0, losses = 0, sum = 0;
  for (const p of paths) {
    let r = p[Math.min(last, p.length - 1)];
    for (let i = 0; i <= last && i < p.length; i++) { if (p[i] >= tp) { r = tp; break; } if (p[i] <= stop) { r = stop; break; } }
    const net = r * 0.98 - 1; sum += net; if (net > 0.03) wins++; else if (net < -0.03) losses++;
  }
  const avg = sum / paths.length;
  return { go: avg > 0.02 && wins > losses, tp, stop, minutes: Math.max(1, Math.round(((last + 1) * 20) / 60)), last };
}
function verdict(o, sig) {
  const drift = clamp(Math.log(Math.max(o.med, 0.05)), -1, 1);
  const red = sig.ladder || sig.rugger || (sig.devSold && o.dump >= 0.15);
  const danger = red || o.dump >= 0.25;
  const runner = !danger && o.p50 >= 0.2 && o.dump <= 0.1;
  const quiet = !danger && !runner && o.p50 + o.dump < 0.1;
  return red ? "rug" : danger ? "down" : runner ? "up" : quiet ? "flat" : "mid";
}
// --- end ---

function trade(path, p) {
  const last = p ? Math.min(29, Math.max(2, Math.round(p.minutes * 3) - 1)) : 29;
  let r = path[Math.min(last, path.length - 1)], why = "time";
  if (p) for (let i = 0; i <= last && i < path.length; i++) {
    if (path[i] >= p.tp) { r = p.tp; why = "tp"; break; }
    if (path[i] <= p.stop) { r = path[i]; why = "stop"; break; }
  }
  return { net: r * (1 - COST) * (1 - COST) - 1, why };
}

const byCp = new Map();
for (const r of rows) { if (!byCp.has(r.cp)) byCp.set(r.cp, []); byCp.get(r.cp).push(r); }
const tests = [];
for (const [cp, arr] of byCp) {
  arr.sort((a, b) => a.at - b.at);
  if (arr.length < 120) continue;
  const t100 = arr[99].at + 600000;
  for (const t of arr) {
    if (t.at <= t100 || !(t.f[4] >= 1.79)) continue;
    const train = arr.filter((y) => y.at < t.at - 600000 && y.mint !== t.mint).slice(-5000);
    if (train.length < 25) continue;
    const s = W.map((_, j) => { const v = train.map((y) => y.f[j]).filter((x) => x != null); const m = v.reduce((a, b) => a + b, 0) / v.length; const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); return sd || 1; });
    const d = train.map((y) => { let x = 0; for (let j = 0; j < 18; j++) if (y.f[j] != null && t.f[j] != null) x += W[j] * ((y.f[j] - t.f[j]) / s[j]) ** 2; return [x, y]; }).sort((a, b) => a[0] - b[0]).slice(0, K).map((z) => z[1]);
    const futs = d.map((y) => y.fut[29]).sort((a, b) => a - b);
    const o = { p50: d.filter((y) => y.mx >= 1.5).length / d.length, dump: d.filter((y) => y.mn <= 0.5).length / d.length, med: q(futs, 0.5) };
    const f = t.f;
    const sig = { ladder: f[13] >= 0.6 && f[5] >= 0.8 && f[1] > 0 && Math.exp(f[4]) - 1 >= 30, rugger: (f[17] ?? 0) >= 0.5, devSold: (f[16] ?? 0) >= 0.5 };
    tests.push({ cp, mint: t.mint, at: t.at, tone: verdict(o, sig), plan: plan(d.map((y) => y.fut)), fut: t.fut, f: t.f, mx: t.mx, mn: t.mn, o, sig });
  }
}
tests.sort((a, b) => a.at - b.at);
const first = (pred) => { const seen = new Set(); return tests.filter((t) => { if (seen.has(t.mint) || !pred(t)) return false; seen.add(t.mint); return true; }); };
const sum = (name, list, planOf) => {
  const res = list.map((t) => trade(t.fut, planOf(t)));
  const n = res.length; if (!n) return console.log(name.padEnd(34), "n=0");
  const nets = res.map((r) => r.net).sort((a, b) => a - b);
  const avg = nets.reduce((a, b) => a + b, 0) / n;
  const wins = nets.filter((x) => x > 0).length;
  const reasons = ["tp", "stop", "time"].map((w) => `${w} ${res.filter((r) => r.why === w).length}`).join(" ");
  const sd = Math.sqrt(nets.reduce((a, b) => a + (b - avg) ** 2, 0) / n);
  console.log(name.padEnd(34), `n=${String(n).padStart(4)}  win ${(wins / n * 100).toFixed(0).padStart(3)}%  avg ${(avg * 100).toFixed(1).padStart(6)}%  ±${(1.96 * sd / Math.sqrt(n) * 100).toFixed(1)}  median ${(q(nets, 0.5) * 100).toFixed(1).padStart(6)}%  pnl/0.1SOL ${(avg * 0.1 * n).toFixed(3).padStart(7)} SOL  ${reasons}`);
};
const DEF = { tp: 1.4, stop: 0.75, minutes: 4 };
const runners = first((t) => t.tone === "up" && t.plan?.go);
console.log(`snapshots ${rows.length}  tests ${tests.length}  coins ${new Set(tests.map((t) => t.mint)).size}  hours ${((tests.at(-1)?.at - tests[0]?.at) / 3.6e6).toFixed(1)}`);
console.log("tones", JSON.stringify(Object.fromEntries(["up", "mid", "flat", "down", "rug"].map((k) => [k, tests.filter((t) => t.tone === k).length]))));
sum("yeppo: Runner + plan go, plan exit", runners, (t) => t.plan);
// control: for every runner pick, a random coin read at the same checkpoint within 5 minutes, same levels
const ctrl = runners.map((r) => { const pool = tests.filter((t) => t.cp === r.cp && t.mint !== r.mint && Math.abs(t.at - r.at) < 300000); return pool.length ? { ...pool[Math.floor(rnd() * pool.length)], plan: r.plan } : null; }).filter(Boolean);
sum("control: random coin, same levels", ctrl, (t) => t.plan);
sum("yeppo picks, held 10 min (no plan)", runners, () => null);
sum("every coin, its own plan", first(() => true), (t) => t.plan ?? DEF);
sum("every coin, held 10 min", first(() => true), () => null);
sum("Likely dump / Rug risk, own plan", first((t) => t.tone === "down" || t.tone === "rug"), (t) => t.plan ?? DEF);
sum("Coin flip, own plan", first((t) => t.tone === "mid"), (t) => t.plan ?? DEF);
sum("any coin where plan says go", first((t) => t.plan?.go), (t) => t.plan);
// how much a "Likely dump" call saves: share that really fell 50%
const dn = first((t) => t.tone === "down" || t.tone === "rug"); const all = first(() => true);
const fell = (l) => l.filter((t) => Math.min(...t.fut) <= 0.5).length / Math.max(1, l.length);
console.log(`fell 50% within 10 min: after a dump/rug call ${(fell(dn) * 100).toFixed(0)}% (n=${dn.length}), any coin ${(fell(all) * 100).toFixed(0)}% (n=${all.length}), after a runner call ${(fell(runners) * 100).toFixed(0)}%`);
const rose = (l) => l.filter((t) => Math.max(...t.fut) >= 1.5).length / Math.max(1, l.length);
console.log(`rose 50% within 10 min: after a runner call ${(rose(runners) * 100).toFixed(0)}%, any coin ${(rose(all) * 100).toFixed(0)}%`);

fs.writeFileSync("tests.json", JSON.stringify(tests));
