/**
 * Bodice / top: neckline, shoulders, bust, waist, down to `endY`.
 * Also returns the shoulder points, where sleeves attach.
 */
import { CX, P, W, ellipsePath, lerp, mirror, smoothPath, symmetricOutline } from "../geometry";
import type { Neckline, TopParams } from "../types";
import { BODY, torsoHalf } from "./body";
import { FillRef, Piece, Z } from "./piece";

export interface TopResult {
  pieces: Piece[];
  /** Where the sleeves attach, or null for bare shoulders. */
  shoulderL: [number, number] | null;
  shoulderR: [number, number] | null;
  /** Half width of the top at its bottom edge. */
  endHalf: number;
}

/** Left half of the neckline, from centre front outwards. */
function necklineLeft(n: Neckline): P[] {
  switch (n) {
    case "crew":
      return [
        [CX, 139],
        [191, 135],
        [186, 128],
      ];
    case "scoop":
      return [
        [CX, 163],
        [186, 153],
        [180, 131],
      ];
    case "v":
      return [
        [CX, 182, true],
        [185, 128, true],
      ];
    case "boat":
      return [
        [CX, 134],
        [182, 131],
        [170, 132],
      ];
    case "square":
      return [
        [CX, 160, true],
        [180, 160, true],
        [180, 131],
      ];
    case "high":
      return [
        [CX, 104],
        [190, 104, true],
        [190, 124],
      ];
    case "halter":
      return [
        [CX, 172],
        [189, 150],
        [193, 110, true],
        [187, 112, true],
      ];
    case "strapless":
    case "one-shoulder":
      return [
        [CX, 168],
        [188, 162],
        [174, 163],
      ];
  }
}

export function buildTop(t: TopParams, fill: FillRef, zBase: number = Z.top): TopResult {
  const ease = (y: number) => 1.5 + t.fit * (y > 200 ? 16 : 8);
  const bare = t.neckline === "strapless" || t.neckline === "halter";
  const shoulderX = CX - BODY.shoulderHalf * t.shoulder - (t.padded ? 3 : 0);
  const shoulderY = BODY.shoulderY - (t.padded ? 4 : 0) + (t.shoulder - 1) * -4;
  const shoulder: P = [shoulderX, shoulderY, t.padded || t.shoulder > 1.3];

  const side = (includeShoulder: boolean): P[] => {
    const pts: P[] = [];
    if (includeShoulder) {
      pts.push(shoulder);
      pts.push([CX - (torsoHalf(BODY.armpitY) + ease(BODY.armpitY)) - (t.shoulder - 1) * 18, BODY.armpitY + 2]);
    }
    const ys = [BODY.bustY, BODY.waistY, 270, BODY.hipY, BODY.crotchY].filter((y) => y < t.endY - 4);
    for (const y of ys) pts.push([CX - torsoHalf(y) - ease(y), y]);
    const endHalf = torsoHalf(t.endY) + ease(t.endY);
    pts.push([CX - endHalf, t.endY, true]);
    return pts;
  };

  const neck = necklineLeft(t.neckline);
  let left: P[] = [...neck, ...side(!bare)];
  let right: P[] = mirror(left);

  if (t.neckline === "one-shoulder") {
    // Left side keeps a shoulder, right side is bare with a diagonal edge.
    left = [[CX, 150], [186, 136], [182, 128], ...side(true)];
    right =[[CX, 150], [212, 158], [226, 164], ...mirror(side(false))];
  }

  const outline = smoothPath(symmetricOutline(left, right), true);
  const endHalf = torsoHalf(t.endY) + ease(t.endY);

  const lines: string[] = [];
  // Draping: soft diagonal folds from one shoulder towards the opposite waist.
  if (t.drape > 0.05) {
    const n = 2 + Math.round(t.drape * 4);
    for (let i = 0; i < n; i++) {
      const u = i / Math.max(1, n - 1);
      const y0 = lerp(150, 200, u);
      const y1 = lerp(200, 245, u);
      lines.push(
        smoothPath([
          [lerp(168, 176, u), y0],
          [lerp(195, 200, u), (y0 + y1) / 2 + 6],
          [lerp(222, 226, u), y1],
        ]),
      );
    }
  }
  // Dart / princess seam hints on fitted tops.
  if (t.fit < 0.4 && t.endY > BODY.waistY) {
    lines.push(smoothPath([[184, 190], [187, BODY.waistY - 4]]));
    lines.push(smoothPath([[W - 184, 190], [W - 187, BODY.waistY - 4]]));
  }

  const pieces: Piece[] = [{ z: zBase, d: outline, fill, lines, lineWidth: 0.7 }];

  if (t.cutout) {
    const y = BODY.waistY - 10;
    const x = torsoHalf(y) - 8;
    pieces.push({ z: zBase + 1, d: ellipsePath(CX - x, y, 7, 14), fill: "body", shade: false, stroke: 1 });
    pieces.push({ z: zBase + 1, d: ellipsePath(CX + x, y, 7, 14), fill: "body", shade: false, stroke: 1 });
  }

  if (t.peplum > 0) {
    const y0 = Math.min(t.endY, BODY.waistY + 4);
    const h0 = torsoHalf(y0) + ease(y0);
    const y1 = y0 + 30 + t.peplum * 0.35;
    const h1 = h0 + t.peplum;
    const hem: P[] = [];
    const waves = 4 + Math.round(t.peplum / 12);
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      hem.push([lerp(CX - h1, CX + h1, u), y1 + Math.sin(Math.PI * u) * 8 + (Math.abs(Math.sin(u * waves * Math.PI)) * 6)]);
    }
    const d = smoothPath([[CX - h0, y0 - 2, true], [CX - h1, y1, true], ...hem.slice(1, -1), [CX + h1, y1, true], [CX + h0, y0 - 2, true]], true);
    const folds = Array.from({ length: waves }, (_, i) => {
      const u = (i + 0.5) / waves;
      return smoothPath([
        [lerp(CX - h0 + 4, CX + h0 - 4, u), y0 + 4],
        [lerp(CX - h1 + 8, CX + h1 - 8, u), y1 + Math.sin(Math.PI * u) * 8],
      ]);
    });
    pieces.push({ z: Z.peplum, d, fill, lines: folds, lineWidth: 0.6 });
  }

  return {
    pieces,
    shoulderL: bare ? null : [shoulder[0], shoulder[1]],
    shoulderR: bare || t.neckline === "one-shoulder" ? null : [W - shoulder[0], shoulder[1]],
    endHalf,
  };
}
