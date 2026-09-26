/**
 * Sleeves: a width profile swept along the arm axis.
 * Each style is just a list of [position along arm, half width] stops,
 * so new styles are one line each.
 */
import { P, along, lerp, profile, smoothPath } from "../geometry";
import type { SleeveStyle } from "../types";
import { armAxis } from "./body";
import { FillRef, Piece } from "./piece";

interface SleeveShape {
  /** Where the sleeve ends: 0 = shoulder, 1 = wrist. */
  length: number;
  stops: [number, number][];
}

const FITTED: [number, number][] = [
  [0, 11],
  [0.5, 9],
  [1, 6.5],
];

const SHAPES: Record<Exclude<SleeveStyle, "none">, SleeveShape> = {
  cap: { length: 0.15, stops: [[0, 13], [1, 12.5]] },
  short: { length: 0.36, stops: [[0, 12], [1, 11.5]] },
  fitted: { length: 1, stops: FITTED },
  bishop: { length: 1.03, stops: [[0, 11], [0.4, 12], [0.88, 21], [0.96, 20], [1, 7]] },
  puff: { length: 0.34, stops: [[0, 15], [0.45, 25], [0.85, 21], [1, 11]] },
  mutton: { length: 1, stops: [[0, 18], [0.28, 27], [0.55, 10], [1, 7]] },
  bell: { length: 1.05, stops: [[0, 11], [0.45, 10], [1, 30]] },
  balloon: { length: 0.97, stops: [[0, 20], [0.4, 48], [0.78, 40], [1, 8]] },
  cascade: { length: 1.12, stops: [[0, 12], [0.35, 19], [1, 54]] },
};

function fittedWidth(t: number) {
  return profile(FITTED, t);
}

export function buildSleeve(
  style: SleeveStyle,
  volume: number,
  shoulder: [number, number],
  side: "left" | "right",
  fill: FillRef,
  z: number,
  extraWidth = 0,
): Piece | null {
  if (style === "none") return null;
  const shape = SHAPES[style];
  const axis = armAxis(shoulder, side);
  const n = 14;
  const outer: P[] = [];
  const inner: P[] = [];
  // Along the arm, the "outer" side is away from the body.
  const outward = side === "left" ? 1 : -1;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * shape.length;
    const u = i / n;
    const base = fittedWidth(Math.min(1, t)) + extraWidth;
    const w = base + (profile(shape.stops, u) + extraWidth - base) * volume;
    const a = along(axis, t * 0.85);
    // normal (nx, ny) points to the left of travel (downwards arm → points to +x). Flip so "outer" is away from body.
    const nx = a.nx * outward;
    const ny = a.ny * outward;
    outer.push([a.x + nx * w * 1.12, a.y + ny * w * 1.12]);
    inner.push([a.x - nx * w * 0.88, a.y - ny * w * 0.88]);
  }
  // Cuff: slightly rounded hem between the two last points.
  const last = n;
  const cuffMid: P = [
    (outer[last][0] + inner[last][0]) / 2,
    (outer[last][1] + inner[last][1]) / 2 + 3 + volume * 3,
  ];
  const pts: P[] = [
    [shoulder[0], shoulder[1], true],
    ...outer.slice(1, last),
    [outer[last][0], outer[last][1], true],
    cuffMid,
    [inner[last][0], inner[last][1], true],
    ...inner.slice(2, last).reverse(),
  ];
  const d = smoothPath(pts, true);

  // Folds for voluminous sleeves.
  const lines: string[] = [];
  const maxW = Math.max(...shape.stops.map((s) => s[1]));
  if (maxW * volume > 18) {
    const count = maxW * volume > 35 ? 4 : 2;
    for (let k = 1; k <= count; k++) {
      const off = lerp(-0.6, 0.6, k / (count + 1));
      const line: P[] = [];
      for (let i = 3; i <= n - 1; i += 2) {
        const t = (i / n) * shape.length;
        const u = i / n;
        const base = fittedWidth(Math.min(1, t)) + extraWidth;
        const w = base + (profile(shape.stops, u) + extraWidth - base) * volume;
        const a = along(axis, t * 0.85);
        line.push([a.x - a.nx * outward * w * off, a.y - a.ny * outward * w * off]);
      }
      lines.push(smoothPath(line));
    }
  }

  return { z, d, fill, lines, lineWidth: 0.6 };
}
