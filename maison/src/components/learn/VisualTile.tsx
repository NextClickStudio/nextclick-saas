"use client";

import { useId } from "react";
import { materialPattern } from "@/lib/cards/materials";
import type { Visual } from "@/lib/learn/types";

/** Draws a colour, a fabric or a mood as a rounded tile that fills its box. */
export function VisualTile({ v, className = "", rounded = "rounded-2xl" }: { v: Visual; className?: string; rounded?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  if (v.kind === "color") return <div className={`${rounded} ring-1 ring-white/10 ${className}`} style={{ background: v.hex }} />;
  if (v.kind === "mood")
    return <div className={`${rounded} ${className}`} style={{ background: `radial-gradient(120% 90% at 20% 10%, ${v.colors[0]}, ${v.colors[1]})` }} />;
  const m = v.material;
  const pattern = materialPattern(m, uid, m.main, m.accent, uid);
  return (
    <div className={`relative overflow-hidden ${rounded} ring-1 ring-white/10 ${className}`} style={{ background: m.main }}>
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs dangerouslySetInnerHTML={{ __html: pattern ?? "" }} />
        {pattern && <rect width="100%" height="100%" fill={`url(#${uid}-mat)`} />}
      </svg>
    </div>
  );
}
