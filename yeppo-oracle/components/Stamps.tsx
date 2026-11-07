"use client";

// The three stamps and the rule behind each one. They come down one after the other the first time they are on screen.
import { useEffect, useRef, useState } from "react";

const RULES: { word: "Safe" | "Risky" | "Danger"; head: string; lines: string[] }[] = [
  {
    word: "Safe",
    head: "Nothing wrong found.",
    lines: ["Every safety check passes", "Insiders under 20% on real balances", "No big wallet selling", "The creator and the money behind them are clean"],
  },
  {
    word: "Risky",
    head: "One thing to watch in who holds it.",
    lines: ["Insiders between 20% and 35%", "One wallet holds a large share", "A big holder is selling now", "Everything else passes"],
  },
  {
    word: "Danger",
    head: "A red flag.",
    lines: ["A failed safety check", "A creator who dumps their coins", "A hidden or large launch bundle", "Already dumped from its high"],
  },
];

export default function Stamps() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setOn(true), io.disconnect()), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`st ${on ? "on" : ""}`}>
      {RULES.map((r, i) => (
        <div key={r.word} className="st-col" style={{ ["--i" as string]: i }}>
          <div className={`st-stamp t-${r.word.toLowerCase()}`}>
            <span>{r.word}</span>
          </div>
          <h3>{r.head}</h3>
          <ul>
            {r.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
