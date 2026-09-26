/**
 * Outerwear: coats and jackets (two overlapping front panels + lapels)
 * and capes (one flared shape from the shoulders).
 */
import { CX, P, W, circlePath, lerp, mirror, smoothPath } from "../geometry";
import type { OuterParams } from "../types";
import { BODY, torsoHalf } from "./body";
import { FillRef, Piece, Z } from "./piece";

export interface OuterResult {
  pieces: Piece[];
  shoulderL: [number, number] | null;
  shoulderR: [number, number] | null;
  waistHalf: number;
}

export function buildOuter(o: OuterParams, fill: FillRef, lapelFill: FillRef): OuterResult {
  if (o.kind === "cape") return buildCape(o, fill);

  const pieces: Piece[] = [];
  const shoulderX = CX - BODY.shoulderHalf * o.shoulder - 4 - (o.padded ? 4 : 0);
  const shoulderY = BODY.shoulderY - 2 - (o.padded ? 5 : 0) - (o.shoulder - 1) * 6;
  const overlap = o.doubleBreasted ? 12 : 5;
  const breakY = o.lapel === "none" || o.lapel === "funnel" ? 140 : 196;

  // Front edge x at a given height (panel extends past centre by `overlap`, opens towards the hem).
  const frontX = (y: number) => {
    const u = Math.max(0, (y - breakY) / Math.max(1, o.hemY - breakY));
    const belt = o.belted ? Math.exp(-Math.pow((y - BODY.waistY) / 30, 2)) : 0;
    return CX + overlap - o.open * Math.pow(u, 1.4) * (1 - belt);
  };

  const hipHalf = Math.max(torsoHalf(BODY.hipY) + 6, lerp(o.waistHalf, o.hemHalf, 0.5));
  const cocoonBulge = o.cocoon * 26;
  const ys = [BODY.waistY, BODY.hipY, lerp(BODY.hipY, o.hemY, 0.5)].filter((y) => y < o.hemY - 10);
  const sidePts: P[] = ys.map((y) => {
    if (y === BODY.waistY) return [CX - o.waistHalf - cocoonBulge * 0.6, y];
    if (y === BODY.hipY) return [CX - hipHalf - cocoonBulge, y];
    return [CX - lerp(hipHalf, o.hemHalf, 0.55) - cocoonBulge * 0.8, y];
  });

  const panel: P[] = [
    [188, 126],
    [shoulderX, shoulderY, o.padded || o.shoulder > 1.25],
    [CX - torsoHalf(BODY.armpitY) - 10 - (o.shoulder - 1) * 22 - cocoonBulge * 0.4, BODY.armpitY + 4],
    ...sidePts,
    [CX - o.hemHalf + o.cocoon * 12, o.hemY, true],
    [frontX(o.hemY), o.hemY + 1, true],
    [frontX(lerp(breakY, o.hemY, 0.5)), lerp(breakY, o.hemY, 0.5)],
    [frontX(breakY), breakY, true],
    [CX - 6, 132],
  ];

  const lines: string[] = [];
  if (o.kind === "coat" || o.hemY > 330) {
    // Pockets
    lines.push(`M${CX - hipHalf + 8} ${BODY.hipY + 8} L${CX - 18} ${BODY.hipY + 10}`);
  }
  // Sleeve seam hint
  lines.push(smoothPath([[shoulderX + 6, shoulderY + 2], [CX - torsoHalf(BODY.armpitY) - 6, BODY.armpitY + 2]]));

  const right = smoothPath(mirror(panel), true);
  const left = smoothPath(panel, true);
  pieces.push({ z: Z.outer, d: right, fill, lines: mirrorLines(lines), lineWidth: 0.6 });
  pieces.push({ z: Z.outerFront, d: left, fill, lines, lineWidth: 0.6 });

  // Lapels
  if (o.lapel === "notch" || o.lapel === "shawl") {
    const tipX = 164 - (o.shoulder - 1) * 18;
    const pts: P[] =
      o.lapel === "notch"
        ? [
            [189, 124, true],
            [173, 136],
            [176, 146, true],
            [tipX, 154, true],
            [frontX(breakY), breakY, true],
            [193, 140],
          ]
        : [
            [189, 124],
            [172, 150],
            [frontX(breakY) - 6, breakY - 6],
            [frontX(breakY), breakY, true],
            [193, 140],
          ];
    const lapelL = smoothPath(pts, true);
    const lapelR = smoothPath(mirror(pts), true);
    pieces.push({ z: Z.collar, d: lapelR, fill: lapelFill, pattern: lapelFill === "main" });
    pieces.push({ z: Z.collar + 1, d: lapelL, fill: lapelFill, pattern: lapelFill === "main" });
  }
  if (o.lapel === "funnel") {
    pieces.push({
      z: Z.collar,
      d: smoothPath([[182, 100], [181, 134, true], [219, 134, true], [218, 100], [200, 96]], true),
      fill,
      lines: [smoothPath([[186, 104], [200, 108], [214, 104]])],
      lineWidth: 0.6,
    });
  }

  // Buttons
  if (o.doubleBreasted || o.open < 10) {
    const btn: string[] = [];
    const cols = o.doubleBreasted ? [CX - 8, CX + 8] : [frontX(BODY.waistY) - 5];
    const rows = o.hemY > 360 ? [205, 245, 285] : [210, 250];
    for (const x of cols) for (const y of rows) btn.push(circlePath(x, y, 2.4));
    pieces.push({ z: Z.detail, d: btn.join(" "), fill: "ink", shade: false, stroke: 0 });
  }

  return {
    pieces,
    shoulderL: [shoulderX + 2, shoulderY + 1],
    shoulderR: [W - shoulderX - 2, shoulderY + 1],
    waistHalf: o.waistHalf + cocoonBulge * 0.6,
  };
}

function mirrorLines(lines: string[]): string[] {
  // Mirror simple path strings by flipping x coordinates of every number pair.
  return lines.map((l) =>
    l.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${(W - parseFloat(x)).toFixed(1)} ${y}`),
  );
}

function buildCape(o: OuterParams, fill: FillRef): OuterResult {
  const half = Math.max(o.hemHalf, 70);
  const hem: P[] = [];
  const N = 24;
  const ripples = 4 + Math.round(o.cocoon * 4);
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    hem.push([
      lerp(CX - half, CX + half, u),
      o.hemY + Math.sin(Math.PI * u) * half * 0.12 + (0.5 - 0.5 * Math.cos(2 * Math.PI * ripples * u)) * 6,
    ]);
  }
  const shoulderSpread = BODY.shoulderHalf * o.shoulder + 8;
  const left: P[] = [
    [CX, 128],
    [186, 122],
    [CX - shoulderSpread * 0.7, 128],
    [CX - shoulderSpread, 146],
    [CX - lerp(shoulderSpread, half, 0.5) - 6, lerp(146, o.hemY, 0.45)],
  ];
  const outline: P[] = [...left, [hem[0][0], hem[0][1], true], ...hem.slice(1, -1), [hem[N][0], hem[N][1], true], ...mirror(left).reverse()];
  const d = smoothPath(outline, true);
  const lines: string[] = [];
  const folds = 5 + Math.round(o.cocoon * 4);
  for (let k = 1; k < folds; k++) {
    const u = k / folds;
    const hx = lerp(CX - half, CX + half, u);
    lines.push(smoothPath([[lerp(CX - shoulderSpread * 0.8, CX + shoulderSpread * 0.8, u), 140 + Math.abs(u - 0.5) * 20], [hx, o.hemY + Math.sin(Math.PI * u) * half * 0.12 + 2]]));
  }
  // Front opening
  if (o.open > 0) lines.push(smoothPath([[CX, 130], [CX + 1, lerp(130, o.hemY, 0.5)], [CX, o.hemY + half * 0.12]]));

  const pieces: Piece[] = [{ z: Z.outer, d, fill, lines, lineWidth: 0.6 }];
  if (o.lapel === "funnel") {
    pieces.push({ z: Z.collar, d: smoothPath([[182, 100], [180, 130, true], [220, 130, true], [218, 100], [200, 96]], true), fill });
  }
  return { pieces, shoulderL: null, shoulderR: null, waistHalf: 0 };
}
