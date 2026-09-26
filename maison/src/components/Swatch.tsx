"use client";

import { useId } from "react";
import type { Family } from "@/lib/cards/families";
import { materialPattern } from "@/lib/cards/materials";
import type { TrendStyle } from "@/lib/cards/view";

const FAMILY_BG: Record<Family, string> = {
  piece: "#f2eee6",
  shoes: "#e3d2b8",
  accessory: "#141312",
  color: "#777777",
  material: "#555555",
  detail: "#262523",
  aesthetic: "#444444",
  beauty: "#eec5bf",
};
const FAMILY_INK: Partial<Record<Family, string>> = { piece: "#0e0e0d", shoes: "#1b1714", accessory: "#d4ad55", beauty: "#2a1414" };

/** A small tile that looks like the card's artwork: used in lists. */
export function Swatch({ family, style, name, size = 44 }: { family: Family; style: TrendStyle; name: string; size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const r = size * 0.28;
  const box = { width: size, height: size, borderRadius: r };
  if (family === "color" && style.hex) return <span className="shrink-0 ring-1 ring-white/10" style={{ ...box, background: style.hex }} />;
  if (family === "aesthetic" && style.mood)
    return <span className="shrink-0" style={{ ...box, background: `radial-gradient(120% 90% at 20% 10%, ${style.mood[0]}, ${style.mood[1]})` }} />;
  if (family === "material" && style.material) {
    const m = style.material;
    const pattern = materialPattern({ ...m, scale: (m.scale ?? 1) * 0.6 }, uid, m.main, m.accent, name);
    return (
      <span className="shrink-0 overflow-hidden" style={{ ...box, background: m.main }}>
        <svg width={size} height={size} aria-hidden>
          <defs dangerouslySetInnerHTML={{ __html: pattern ?? "" }} />
          {pattern && <rect width="100%" height="100%" fill={`url(#${uid}-mat)`} />}
        </svg>
      </span>
    );
  }
  const initials = name
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <span
      className={`grid shrink-0 place-items-center font-black tracking-tight ${family === "accessory" ? "ring-1 ring-gold/40" : ""}`}
      style={{ ...box, background: FAMILY_BG[family], color: FAMILY_INK[family] ?? "#f2eee6", fontSize: size * 0.34 }}
    >
      {initials}
    </span>
  );
}
