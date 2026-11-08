"use client";

// The home's motion vocabulary, kept to three moves: words rise out of their own line, rules draw from the left,
// numbers settle. Each runs once, the first time it is on screen, and not at all with reduced motion.
import { useEffect, useRef, useState, type ReactNode } from "react";

function useSeen<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return void setSeen(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setSeen(true), io.disconnect()), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

/** a headline whose words rise one after the other, each out of its own line */
export function Kinetic({ lines, as: Tag = "h1", className, delay = 0 }: { lines: string[]; as?: "h1" | "h2"; className?: string; delay?: number }) {
  const [ref, seen] = useSeen<HTMLHeadingElement>(0.2);
  let n = 0;
  return (
    <Tag ref={ref} className={`kin ${seen ? "on" : ""} ${className ?? ""}`}>
      {lines.map((l, li) => (
        <span key={li} className="kin-line">
          {l.split(" ").map((w, wi) => (
            <span key={wi} className="kin-w">
              <span style={{ transitionDelay: `${delay + n++ * 0.07}s` }}>{w}</span>
            </span>
          ))}
        </span>
      ))}
    </Tag>
  );
}

/** a block that comes up with a rule drawn above it */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const [ref, seen] = useSeen<HTMLDivElement>(0.15);
  return (
    <div ref={ref} className={`rv2 ${seen ? "on" : ""} ${className ?? ""}`} style={{ ["--d" as string]: `${delay}s` }}>
      {children}
    </div>
  );
}
