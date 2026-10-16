import type { CSSProperties } from "react";

const COLORS = ["var(--volt)", "var(--ion)", "var(--hot)", "var(--ultra)", "var(--flame)"];

/** Un'esplosione di coriandoli in CSS: parte appena il componente compare. */
export function Confetti({ count = 30 }: { count?: number }) {
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <i
          key={i}
          style={
            {
              "--a": `${(i * 137.5) % 360}deg`,
              "--d": `${110 + ((i * 47) % 150)}px`,
              "--r": `${180 + ((i * 83) % 540)}deg`,
              background: COLORS[i % COLORS.length],
              animationDelay: `${(i % 6) * 25}ms`,
              width: i % 3 === 0 ? 10 : 7,
              height: i % 3 === 0 ? 10 : 15,
              borderRadius: i % 3 === 0 ? "50%" : 2,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
