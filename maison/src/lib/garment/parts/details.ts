/** Collars, belts, bows, studs. */
import { CX, P, circlePath, lerp, mirror, smoothPath } from "../geometry";
import type { Collar } from "../types";
import { BODY } from "./body";
import { Piece, Z } from "./piece";

export function buildCollar(c: Collar, size: number): Piece[] {
  switch (c) {
    case "none":
      return [];
    case "shirt": {
      const pts: P[] = [[191, 122, true], [177, 140, true], [198, 138, true]];
      return [
        { z: Z.collar, d: smoothPath(pts, true), fill: "accent", pattern: false },
        { z: Z.collar, d: smoothPath(mirror(pts), true), fill: "accent", pattern: false },
      ];
    }
    case "peter-pan": {
      const pts: P[] = [[CX, 132, true], [189, 124], [176, 132], [182, 146], [198, 142]];
      return [
        { z: Z.collar, d: smoothPath(pts, true), fill: "chalk", pattern: false },
        { z: Z.collar, d: smoothPath(mirror(pts), true), fill: "chalk", pattern: false },
      ];
    }
    case "funnel":
      return [
        {
          z: Z.collar,
          d: smoothPath([[184, 100], [183, 130, true], [217, 130, true], [216, 100], [200, 97]], true),
          fill: "main",
          lines: [smoothPath([[187, 104], [200, 107], [213, 104]])],
          lineWidth: 0.6,
        },
      ];
    case "ruff": {
      // Pleated millstone ruff: a zigzag ring, bigger with rarity.
      const r = 18 + size * 38;
      const cy = 121;
      const n = Math.round(22 + size * 26);
      const outer: P[] = [];
      const lines: string[] = [];
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2;
        const rr = i % 2 === 0 ? r : r * 0.86;
        outer.push([CX + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.42, true]);
        if (i % 2 === 0) lines.push(`M${(CX + Math.cos(a) * 9).toFixed(1)} ${(cy + Math.sin(a) * 4).toFixed(1)} L${(CX + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr * 0.42).toFixed(1)}`);
      }
      return [{ z: Z.bigDetail, d: smoothPath(outer, true), fill: "chalk", pattern: false, lines, lineWidth: 0.5 }];
    }
    case "bow":
      return buildBow(CX, 132, 0.8 + size * 0.6, Z.collar);
  }
}

/** Bow with two loops and two tails. */
export function buildBow(x: number, y: number, s: number, z: number = Z.bigDetail): Piece[] {
  const loop = (dir: number): P[] => [
    [x, y, true],
    [x + dir * 14 * s, y - 11 * s],
    [x + dir * 22 * s, y - 4 * s],
    [x + dir * 20 * s, y + 7 * s],
    [x + dir * 8 * s, y + 5 * s],
  ];
  const tail = (dir: number): P[] => [
    [x - dir * 2 * s, y + 2 * s, true],
    [x + dir * 6 * s, y + 18 * s],
    [x + dir * 10 * s, y + 34 * s, true],
    [x + dir * 16 * s, y + 30 * s, true],
    [x + dir * 7 * s, y + 3 * s, true],
  ];
  return [
    { z, d: smoothPath(tail(-1), true) + " " + smoothPath(tail(1), true), fill: "accent", pattern: false },
    {
      z: z + 0.1,
      d: smoothPath(loop(-1), true) + " " + smoothPath(loop(1), true),
      fill: "accent",
      pattern: false,
      lines: [
        smoothPath([[x - 5 * s, y - 2 * s], [x - 14 * s, y - 3 * s]]),
        smoothPath([[x + 5 * s, y - 2 * s], [x + 14 * s, y - 3 * s]]),
      ],
      lineWidth: 0.5,
    },
    { z: z + 0.2, d: smoothPath([[x - 4 * s, y - 4 * s], [x + 4 * s, y - 4 * s], [x + 4 * s, y + 4 * s], [x - 4 * s, y + 4 * s]], true), fill: "accent", pattern: false },
  ];
}

export function buildBelt(half: number, studs: boolean, tie: boolean): Piece[] {
  const y = BODY.waistY;
  const band = smoothPath(
    [
      [CX - half, y - 6, true],
      [CX, y - 4],
      [CX + half, y - 6, true],
      [CX + half, y + 6, true],
      [CX, y + 8],
      [CX - half, y + 6, true],
    ],
    true,
  );
  const pieces: Piece[] = [{ z: Z.belt, d: band, fill: "accent", pattern: false }];
  if (tie) {
    const ends: P[] = [[CX - 6, y + 4, true], [CX - 12, y + 40], [CX - 6, y + 70, true], [CX - 1, y + 68, true], [CX - 5, y + 40], [CX, y + 5, true]];
    pieces.push({ z: Z.belt + 1, d: smoothPath(ends, true) + " " + smoothPath(mirror(ends).map((p) => [p[0] - 6, p[1] + 2, p[2] ?? false] as P), true), fill: "accent", pattern: false });
  } else {
    pieces.push({ z: Z.belt + 1, d: `M${CX - 7} ${y - 7} H${CX + 7} V${y + 8} H${CX - 7} Z M${CX - 4} ${y - 4} H${CX + 4} V${y + 5} H${CX - 4} Z`, fill: "ink", shade: false, stroke: 0 });
  }
  if (studs) pieces.push(studRow([[CX - half + 5, y], [CX - 12, y + 1]], 6), studRow([[CX + 12, y + 1], [CX + half - 5, y]], 6));
  return pieces;
}

/** A row of metal studs between two points. */
export function studRow(pts: [P, P], count: number): Piece {
  const [a, b] = pts;
  const d: string[] = [];
  for (let i = 0; i < count; i++) {
    const u = count === 1 ? 0.5 : i / (count - 1);
    d.push(circlePath(lerp(a[0], b[0], u), lerp(a[1], b[1], u), 1.6));
  }
  return { z: Z.detail, d: d.join(" "), fill: "metal", stroke: 0.5, shade: false, pattern: false };
}
