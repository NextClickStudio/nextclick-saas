"use client";

// The three verdicts, set as three rows of one table: the word, the coin's fingerprint (one bar per check, the same
// bars the read above ends on) and the rule. The bars fill in check by check the first time a row is on screen; the
// row a pointer rests on lights up and the other two step back.
import { useEffect, useRef, useState } from "react";
import { CHECKS } from "@/lib/checks";

type V = "Safe" | "Risky" | "Danger";
const N = CHECKS.length;
// which checks fail on a typical coin of each verdict (indexes into the 24): none; a holder warning or two; red flags
const PRINT: Record<V, { warn: number[]; bad: number[] }> = {
  Safe: { warn: [], bad: [] },
  Risky: { warn: [1, 4, 23], bad: [] },
  Danger: { warn: [3, 8], bad: [0, 9, 10, 11, 16] },
};
const ROWS: { word: V; head: string; lines: string[] }[] = [
  { word: "Safe", head: "Nothing wrong found", lines: ["Every safety check passes", "Insiders under 20% on real balances", "No big wallet selling", "Creator and their money are clean"] },
  { word: "Risky", head: "One thing to watch in who holds it", lines: ["Insiders between 20% and 35%", "One wallet holds a large share", "A big holder is selling now", "Everything else passes"] },
  { word: "Danger", head: "A red flag", lines: ["A failed safety check", "A creator who dumps their coins", "A hidden or large launch bundle", "Already dumped from its high"] },
];

export default function Stamps() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [hover, setHover] = useState<V | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setOn(true), io.disconnect()), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`vt ${on ? "on" : ""} ${hover ? "hov" : ""}`} onPointerLeave={() => setHover(null)}>
      {ROWS.map((r, ri) => {
        const t = r.word.toLowerCase();
        return (
          <div key={r.word} className={`vt-row t-${t} ${hover === r.word ? "lit" : ""}`} onPointerEnter={() => setHover(r.word)} style={{ ["--r" as string]: ri }}>
            <b className="vt-word">{r.word}</b>
            <div className="vt-print" aria-label={`${N - PRINT[r.word].warn.length - PRINT[r.word].bad.length} of ${N} checks clean`}>
              {Array.from({ length: N }, (_, i) => (
                <i key={i} className={PRINT[r.word].bad.includes(i) ? "bad" : PRINT[r.word].warn.includes(i) ? "warn" : "ok"} style={{ ["--i" as string]: i }} />
              ))}
              <span className="vt-count">
                {N - PRINT[r.word].warn.length - PRINT[r.word].bad.length}/{N} clean
              </span>
            </div>
            <div className="vt-rule">
              <h3>{r.head}</h3>
              <ul>
                {r.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}
