"use client";

// Film 02 · Wallet radar. The viewer's wallets sit in a column; one buys a coin, a line runs to it; a second one buys
// the same coin; the rule checks itself line by line; every line passes and an early call lands. 12 seconds.
import { at, io, k, mix, out, type Film } from "./engine";
import { Rise, Tick } from "./parts";

const WALLETS = ["OGAntD", "Chinaman", "cup 1", "nyhrox", "Cented", "Orange", "Mel", "lynk"];
const RULE = ["2+ of your wallets in 15 min", "None of them selling", "Creator paid by an exchange", "Mint, freeze, liquidity safe", "Top 10 under 30%", "yeppo reads it Safe"];
const COIN = { x: 600, y: 330 };
const ROW = (i: number) => ({ x: 120, y: 150 + i * 62 });

function Scene({ t }: { t: number }) {
  const a = k(t, 1.6, 2.6, io); // wallet 0 → coin
  const b = k(t, 3.6, 4.6, io); // wallet 3 → coin
  const coinIn = k(t, 1.9, 2.6);
  const call = k(t, 9.2, 10.0);
  const line = (i: number, p: number) => {
    const r = ROW(i);
    const x1 = r.x + 220, y1 = r.y + 20, x2 = COIN.x, y2 = COIN.y + 36;
    const mx = (x1 + x2) / 2;
    return <path d={`M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} fill="none" stroke="#fff" strokeWidth="1.5" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />;
  };
  return (
    <div className="fm">
      <div className="fm-label" style={at(120, 96, { opacity: k(t, 0.1, 0.6) })}>
        Your wallets · {WALLETS.length * 15} followed
      </div>
      {WALLETS.map((w, i) => {
        const r = ROW(i);
        const v = k(t, 0.15 + i * 0.07, 0.65 + i * 0.07);
        const lit = (i === 0 && t > 1.6) || (i === 3 && t > 3.6);
        return (
          <div key={w} className={`fm-wal ${lit ? "lit" : ""}`} style={at(r.x, r.y, { opacity: v, transform: `translateX(${mix(-16, 0, v)}px)` })}>
            <i>{w.slice(0, 1).toUpperCase()}</i>
            <span>{w}</span>
            {lit && <em>bought {i === 0 ? "0.8" : "1.2"} SOL</em>}
          </div>
        );
      })}
      <svg width="1280" height="800" style={at(0, 0)}>
        {line(0, a)}
        {line(3, b)}
      </svg>
      <div className="fm-coinchip" style={at(COIN.x, COIN.y, { opacity: coinIn, transform: `scale(${mix(0.9, 1, out(coinIn))})` })}>
        <b>$KITE</b>
        <span>{t < 3.6 ? "1 of your wallets" : "2 of your wallets · 4 min"}</span>
        <em>$31K</em>
      </div>
      <div className="fm-rule" style={at(880, 150, { opacity: k(t, 4.8, 5.4) })}>
        <div className="fm-label">Your rule</div>
        {RULE.map((r, i) => {
          const s = 5.3 + i * 0.55;
          return (
            <div key={r} className="fm-rule-row" style={{ opacity: mix(0.25, 1, k(t, s, s + 0.3)) }}>
              <Tick p={k(t, s, s + 0.4)} />
              <span>{r}</span>
            </div>
          );
        })}
      </div>
      {/* the early call, landing like a notification */}
      <div className="fm-call" style={at(880, 560, { opacity: call, transform: `translateY(${mix(24, 0, out(call))}px)` })}>
        <span className="fm-call-k">Early call</span>
        <b>$KITE</b>
        <span>2 of your wallets in · every line passes · Safe</span>
      </div>
      <Rise p={k(t, 10.1, 10.8)} className="fm-note" style={at(880, 660)}>
        yeppo never trades for you.
      </Rise>
    </div>
  );
}

export const filmRadar: Film = {
  id: "radar",
  title: "Wallet radar",
  line: "Paste the wallets you follow on Axiom. When two of them buy the same coin and every line of your rule passes, you get an early call.",
  duration: 12,
  chapters: [
    { at: 0, label: "Your wallets" },
    { at: 1.6, label: "One buys" },
    { at: 3.6, label: "Two buy" },
    { at: 5.2, label: "Your rule" },
    { at: 9.2, label: "Early call" },
  ],
  caption: (t) => (t < 3.6 ? "One of your wallets buys. yeppo reads the coin at once." : t < 5.2 ? "A second one buys the same coin." : t < 9.2 ? "Your rule, checked line by line." : t < 11.3 ? "Every line passes: an early call." : ""),
  Scene,
};
