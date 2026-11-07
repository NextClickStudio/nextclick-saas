"use client";

// The hero's live-looking example of the panel: three scenes on a loop, tilting with the mouse. Made-up coins,
// labelled as an example.
import { useEffect, useRef, useState } from "react";
import type { PastCoin } from "@/lib/decide";
import Overlay from "./Overlay";

/** an example price path: up to a peak, then a fall (as multiples of launch, every 30 s for 20 minutes) */
function path(peak: number, at: number, end: number, wobble = 0.05, seed = 1): number[] {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280 - 0.5) * 2;
  return Array.from({ length: 40 }, (_, i) => {
    const t = (i + 1) * 30;
    const v = t <= at ? 1 + (peak - 1) * Math.pow(t / at, 1.4) : end + (peak - end) * Math.exp(-(t - at) / 70);
    return Math.max(0.3, v * (1 + rnd() * wobble));
  });
}
const ghost = (id: string, fate: PastCoin["fate"], p: number[]): PastCoin => ({ mint: id, sym: null, t0: 0, fate, peak: Math.max(...p), peakS: null, soldS: null, soldX: null, rugS: null, rugDrop: null, path: p });
const me = (p: number[], upTo: number): [number, number][] => p.slice(0, upTo).map((v, i) => [(i + 1) * 30, v]);

const SCENES = [
  {
    sym: "$GLORP",
    mc: "$18.4k",
    tone: "up",
    word: "Safe",
    why: "Nothing wrong found: insiders 9%, creator: 4 coins, 0 rugged, 10/10 checks safe.",
    stats: ["+18%", "64 / 19", "41", "$3.1k"],
    me: me(path(2.1, 330, 1.9, 0.04, 3), 8),
    ghosts: [ghost("a", "ran", path(4.2, 600, 2.8, 0.05, 5)), ghost("b", "dead", path(2.4, 260, 0.8, 0.06, 8)), ghost("c", "ran", path(3.1, 420, 2.2, 0.05, 11))],
    sell: [240, 2.6] as [number, number],
    line: "4 coins: 3 ran, 0 rugged, 1 faded.",
    kols: [["Cented", "12 SOL", "+41s", 1], ["milito", "2.1 SOL", "+1m", 1], ["decu", "3.5 SOL", "+3s", 0]] as [string, string, string, number][],
    hold: [0.02, 0.03, 0.04, 0.58],
    exit: null as string | null,
  },
  {
    sym: "$MOONDOG",
    mc: "$9.2k",
    tone: "down",
    word: "Danger",
    why: "This creator dumped 6 of their last 7 coins in seconds.",
    stats: ["+31%", "88 / 12", "57", "$5.6k"],
    me: me(path(2.2, 300, 2, 0.03, 13), 7),
    ghosts: [ghost("d", "rug", path(2.6, 210, 0.35, 0.03, 17)), ghost("e", "rug", path(2.2, 180, 0.3, 0.03, 19)), ghost("f", "rug", path(3, 240, 0.32, 0.03, 23)), ghost("g", "rug", path(2.4, 200, 0.4, 0.03, 29))],
    sell: [205, 2.4] as [number, number],
    line: "Serial rugger: dumped 6 of 7 coins in seconds.",
    kols: [] as [string, string, string, number][],
    hold: [0.12, 0.24, 0.09, 0.2],
    exit: null as string | null,
  },
  {
    sym: "$SNEK",
    mc: "$41.0k",
    tone: "mid",
    word: "Risky",
    why: "One wallet holds 11%. It can crash the price on its own.",
    stats: ["−9%", "14 / 31", "22", "$1.2k"],
    me: me(path(4.4, 420, 3.2, 0.05, 31), 18),
    ghosts: [ghost("h", "ran", path(5.1, 560, 3.8, 0.05, 37)), ghost("i", "dead", path(1.8, 150, 0.9, 0.05, 41))],
    sell: [480, 4.6] as [number, number],
    line: "2 coins: 1 ran, 0 rugged, 1 faded.",
    kols: [["Cented", "8.0 SOL", "+2m", 0], ["theo", "1.4 SOL", "+3m", 0]] as [string, string, string, number][],
    hold: [0, 0.05, 0.02, 0.71],
    exit: "Every top trader is out (Cented, theo)." as string | null,
  },
];

export default function Demo() {
  const [i, setI] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % SCENES.length), 5200);
    return () => clearInterval(t);
  }, []);
  const s = SCENES[i];
  return (
    <div
      className="demo"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const dx = (e.clientX - r.left) / r.width - 0.5;
        const dy = (e.clientY - r.top) / r.height - 0.5;
        if (card.current) card.current.style.transform = `rotateY(${dx * 9}deg) rotateX(${-dy * 9}deg)`;
      }}
      onMouseLeave={() => {
        if (card.current) card.current.style.transform = "";
      }}
    >
      <div className="demo-halo" />
      <div ref={card} className="demo-card card glow-edge" style={{ padding: 14 }}>
        <div className="cp">
          <div className="cp-head">
            <div className="cimg" style={{ width: 34, height: 34, fontSize: 12 }}>
              {s.sym.slice(1, 3)}
            </div>
            <div>
              <b>{s.sym}</b>
              <span className="sub">pump.fun · example</span>
            </div>
            <div className="cp-mc">
              <b className="mono">{s.mc}</b>
              <span className="sub">market cap</span>
            </div>
          </div>
          <section className={`cp-call t-${s.tone}`}>
            <div key={s.word} className="cp-word cp-word-in">
              <i />
              {s.word}
            </div>
            <p key={s.why} className="cp-word-in">
              {s.why}
            </p>
            {s.exit && (
              <div className="cp-exit cp-word-in">
                <b>Exit</b>
                {s.exit}
              </div>
            )}
          </section>
          <section className="cp-row" key={`k${i}`}>
            <header>
              <h3>Top traders</h3>
              <span className="grow" />
              <span className={`cp-sum ${s.kols.length ? (s.kols.some((k) => k[3]) ? "up" : "down") : ""}`}>
                {s.kols.length ? `${s.kols.filter((k) => k[3]).length} in · ${s.kols.filter((k) => !k[3]).length} out` : "None"}
              </span>
            </header>
            {s.kols.length ? (
              <div className="cp-kols">
                {s.kols.map(([n, v, t, held], k) => (
                  <div key={n} className={`cp-kol cp-word-in ${held ? "in" : "out"}`} style={{ animationDelay: `${k * 90}ms` }}>
                    <i />
                    <b>{n}</b>
                    <span className="mono">{v}</span>
                    <span className="mono dim">{t}</span>
                    <span className="mono">{held ? "holding" : "sold"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="cp-line mute">None of the top traders bought it.</p>
            )}
          </section>
          <section className="cp-row">
            <header>
              <h3>Who holds it</h3>
              <span className="grow" />
              <span className={`cp-sum ${s.hold[0] + s.hold[1] + s.hold[2] >= 0.25 ? "down" : "up"}`}>Insiders {Math.round((s.hold[0] + s.hold[1] + s.hold[2]) * 100)}%</span>
            </header>
            <div className="cp-bar">
              {s.hold.map((v, k) => (
                <i key={k} style={{ width: `${v * 100}%`, background: ["var(--dev)", "var(--down)", "var(--mid)", "var(--up)"][k] }} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** a small looping version of the overlay for the feature card */
export function MiniOverlay() {
  return (
    <div style={{ width: "88%" }}>
      <Overlay me={me(path(1.9, 300, 1.7, 0.04, 3), 9)} ghosts={SCENES[1].ghosts.slice(0, 3)} sellS={205} sellX={2.4} />
    </div>
  );
}
