"use client";

// Small moving parts of the home: a number that rolls in digit by digit, a UTC clock, and two looping examples
// (the wallet radar taking in a new coin, a post on X wiring itself to the coins born after it).
import { useEffect, useRef, useState } from "react";

/** a number whose digits roll into place, like a mechanical counter, the first time it is on screen */
export function Odo({ n, className }: { n: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setOn(true), io.disconnect()), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const s = n.toLocaleString("en-US");
  let d = 0;
  return (
    <span ref={ref} className={`odo ${on ? "on" : ""} ${className ?? ""}`} aria-label={s}>
      {s.split("").map((ch, i) => {
        if (!/\d/.test(ch)) return <span key={i} className="odo-sep" aria-hidden>{ch}</span>;
        const v = Number(ch), k = d++;
        return (
          <span key={i} className="odo-d" aria-hidden>
            <span className="odo-col" style={{ transform: `translateY(${on ? -(v + 10) * 5 : 0}%)`, transitionDelay: `${k * 70}ms` }}>
              {[...Array(20)].map((_, j) => (
                <span key={j}>{j % 10}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function Clock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const f = () => setT(new Date().toISOString().slice(11, 19));
    f();
    const i = setInterval(f, 1000);
    return () => clearInterval(i);
  }, []);
  return <span className="x-clock">UTC {t || "--:--:--"}</span>;
}

// ---- the radar, taking in coins (example) ---------------------------------------------------------------------------
const FEED: [string, string, string, "up" | "mid" | "down", boolean[]][] = [
  ["$SEAL", "2 of your wallets · 4 min", "Early call", "up", [true, true, true, true, true, true]],
  ["$GOAT", "1 of your wallets · bundle 38%", "Danger", "down", [false, true, false, true, false, false]],
  ["$KITE", "3 of your wallets · 9 min", "Early call", "up", [true, true, true, true, true, true]],
  ["$BOOK", "2 in · a lead wallet is out", "Risky", "mid", [false, true, true, true, true, false]],
  ["$MOTH", "1 of your wallets · funder rugged 14", "Danger", "down", [false, false, true, false, false, false]],
];
const RULE = ["2+ wallets in 15 min", "funded by an exchange", "mint, freeze, LP", "top 10 under 30%", "$25K or more", "Safe read"];

export function RadarLoop() {
  const [i, setI] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return void setTick(6);
    const a = setInterval(() => setTick((t) => t + 1), 260);
    return () => clearInterval(a);
  }, []);
  useEffect(() => {
    if (tick >= 12) {
      setI((v) => v + 1);
      setTick(0);
    }
  }, [tick]);
  const rows = [0, 1, 2, 3].map((k) => FEED[(i - k + FEED.length * 99) % FEED.length]);
  const top = rows[0];
  return (
    <div className="xr">
      <div className="xr-rows" key={i}>
        {rows.map(([s, l, w, t], k) => (
          <div key={s + k} className={`xr-row ${k === 0 ? "new" : ""}`} style={{ ["--k" as string]: k }}>
            <b>{s}</b>
            <span>{l}</span>
            <em className={t}>{k === 0 && tick < 7 ? "reading" : w}</em>
          </div>
        ))}
      </div>
      <ul className="xr-rule">
        {RULE.map((r, k) => {
          const done = tick > k;
          const ok = top[4][k];
          return (
            <li key={r} className={done ? (ok ? "ok" : "no") : ""}>
              <i>{done ? (ok ? "✓" : "×") : "·"}</i>
              {r}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---- a post, the coins born after it (example) ---------------------------------------------------------------------
const BORN: [string, string, "up" | "mid" | "down", string][] = [
  ["$WHALE", "Safe", "up", "2 of your wallets in"],
  ["$OCEAN", "Danger", "down", "bundle 41%"],
  ["$BACK", "Risky", "mid", "creator's 9th coin today"],
];

export function PostLoop() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return void setPh(4);
    const a = setInterval(() => setPh((p) => (p + 1) % 6), 1100);
    return () => clearInterval(a);
  }, []);
  return (
    <div className={`xp ph${ph}`}>
      <div className="xp-post">
        <span className="xp-who">
          <i />
          <b>a large account</b> · 2 min ago
        </span>
        <p>whales are back. the ocean always wins</p>
      </div>
      <svg className="xp-wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {[18, 50, 82].map((y, k) => (
          <path key={y} className={`w${k}`} d={`M0 50 C 40 50, 60 ${y}, 100 ${y}`} pathLength={1} />
        ))}
      </svg>
      <div className="xp-born">
        {BORN.map(([s, w, t, why], k) => (
          <div key={s} className={`xp-coin c${k} ${t}`}>
            <b>{s}</b>
            <span>{why}</span>
            <em>{w}</em>
          </div>
        ))}
      </div>
    </div>
  );
}
