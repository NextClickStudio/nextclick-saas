"use client";

import { useEffect, useState } from "react";

const WORDS = ["guitar", "snowboard", "chess", "cooking", "piano", "politics", "physics", "skiing"];

/** La parola che cambia nel titolo: "Learn ___ by scrolling." */
export function RotatingWord() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % WORDS.length), 2400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="rotator" aria-live="polite">
      <span key={index} className="rotator-word hl">
        {WORDS[index]}
      </span>
    </span>
  );
}
