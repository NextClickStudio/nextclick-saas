"use client";

import { useEffect, useState } from "react";

const WORDS = ["guitar", "snowboard tricks", "chess openings", "Italian politics", "knife skills", "skiing"];

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
      <span key={index} className="rotator-word grad-text">
        {WORDS[index]}
      </span>
    </span>
  );
}
