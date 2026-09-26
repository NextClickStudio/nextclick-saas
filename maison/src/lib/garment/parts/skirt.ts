/**
 * Skirts (also the lower half of dresses): silhouette + rippled hem + folds,
 * tiers, slits, asymmetric hems, trains, fringe and ruffles.
 */
import { CX, P, lerp, profile, smoothPath } from "../geometry";
import type { SkirtParams } from "../types";
import { BODY, torsoHalf } from "./body";
import { FillRef, Piece, Z } from "./piece";

/** Left-side width profile [y, halfWidth] for a skirt shape. */
function sideProfile(s: SkirtParams, hemY: number, hemHalf: number): [number, number][] {
  const top = s.topY;
  const topHalf = torsoHalf(top) + 1.5;
  const hipHalf = Math.max(torsoHalf(BODY.hipY) + 2, topHalf);
  const span = hemY - top;
  const at = (u: number) => top + span * u;
  switch (s.shape) {
    case "pencil":
      return [[top, topHalf], [Math.min(BODY.hipY, at(0.5)), hipHalf], [hemY, Math.min(hemHalf, hipHalf - 4)]];
    case "column":
      return [[top, topHalf], [Math.min(BODY.hipY, at(0.4)), hipHalf], [hemY, Math.max(hipHalf + 2, hemHalf * 0.6)]];
    case "aline":
      return [[top, topHalf], [at(0.3), lerp(topHalf, hemHalf, 0.4)], [hemY, hemHalf]];
    case "full":
      return [[top, topHalf], [top + 18, topHalf + hemHalf * 0.3], [at(0.45), hemHalf * 0.85], [hemY, hemHalf]];
    case "mermaid": {
      const knee = Math.min(BODY.kneeY - 10, at(0.62));
      return [[top, topHalf], [BODY.hipY, hipHalf], [knee, 27], [hemY, hemHalf]];
    }
    case "bubble":
      return [[top, topHalf], [at(0.55), hemHalf], [hemY, hemHalf * 0.62]];
    case "tulip":
      return [[top, topHalf], [at(0.5), hemHalf], [hemY - 6, hemHalf * 0.72]];
  }
}

interface SkirtLayer {
  hemY: number;
  hemHalf: number;
}

function layerPiece(s: SkirtParams, layer: SkirtLayer, fill: FillRef, z: number, withSlit: boolean): Piece {
  const prof = sideProfile(s, layer.hemY, layer.hemHalf);
  const top = s.topY;
  const drop = s.asym * 140; // right side hangs lower
  const hemL = layer.hemY;
  const hemR = Math.min(622, layer.hemY + drop);
  const leftPts: P[] = [];
  const rightPts: P[] = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const yL = lerp(top, hemL, u);
    const yR = lerp(top, hemR, u);
    // Look the width up on the original (unslanted) profile.
    const w = profile(prof, lerp(top, layer.hemY, u));
    leftPts.push([CX - w, yL]);
    rightPts.push([CX + w, yR]);
  }
  leftPts[0] = [leftPts[0][0], top, true];
  rightPts[0] = [rightPts[0][0], top, true];

  // Hem: perspective sag + ripples (godets) proportional to volume.
  const hemHalf = profile(prof, layer.hemY);
  const ripples = 3 + Math.round(s.volume * 7);
  const amp = s.volume < 0.2 ? 0 : s.volume * (4 + hemHalf / 18);
  const sag = hemHalf * 0.1;
  const hem: P[] = [];
  const N = 30;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const x = lerp(CX - hemHalf, CX + hemHalf, u);
    const y = lerp(hemL, hemR, u) + Math.sin(Math.PI * u) * sag + (0.5 - 0.5 * Math.cos(2 * Math.PI * ripples * u)) * amp;
    hem.push([x, y]);
  }

  // Slit: a notch in the hem that reveals the leg.
  if (withSlit && s.slit !== "none") {
    const us = s.slit === "left" ? 0.3 : s.slit === "right" ? 0.7 : 0.5;
    const idx = Math.round(us * N);
    const [sx, sy] = hem[idx];
    const slitTop = Math.max(BODY.hipY + 30, sy - (sy - BODY.hipY) * 0.55);
    hem.splice(idx, 1, [sx - 4, sy, true], [sx, slitTop, true], [sx + 4, sy, true]);
  }

  hem[0] = [hem[0][0], hem[0][1], true];
  hem[hem.length - 1] = [hem[hem.length - 1][0], hem[hem.length - 1][1], true];

  const outline: P[] = [...leftPts.slice(0, -1), ...hem, ...rightPts.slice(0, -1).reverse()];
  const d = smoothPath(outline, true);

  // Folds from under the waist down to the hem troughs.
  const lines: string[] = [];
  const folds = Math.round(1 + s.volume * 7 + (hemHalf > 60 ? 2 : 0));
  const topHalf = torsoHalf(top);
  for (let k = 1; k < folds + 1; k++) {
    const u = k / (folds + 1);
    const hx = lerp(CX - hemHalf, CX + hemHalf, u);
    const hy = lerp(hemL, hemR, u) + Math.sin(Math.PI * u) * sag + amp * 0.2;
    const mermaid = s.shape === "mermaid";
    const startY = mermaid ? Math.min(BODY.kneeY, lerp(top, layer.hemY, 0.62)) + 4 : top + 18 + ((k * 37) % 5) * 7;
    const startHalf = mermaid ? 22 : topHalf;
    const sx = lerp(CX - startHalf, CX + startHalf, u);
    lines.push(smoothPath([[sx, startY], [lerp(sx, hx, 0.5) + (u - 0.5) * 6, lerp(startY, hy, 0.5)], [hx, hy - 2]]));
  }
  if (s.shape === "tulip") {
    lines.push(smoothPath([[CX - topHalf + 4, top + 6], [CX + 8, lerp(top, hemL, 0.6)], [CX + hemHalf * 0.5, hemL + 2]]));
  }

  return { z, d, fill, lines, lineWidth: 0.6 };
}

export function buildSkirt(s: SkirtParams, fill: FillRef, extras: { fringe: boolean; ruffleHem: boolean }): Piece[] {
  const pieces: Piece[] = [];
  const tiers = Math.max(1, s.tiers);

  // Train pools on the floor behind the skirt.
  if (s.train > 0.05) {
    const half = s.hemHalf + 30 + s.train * 70;
    const yTop = Math.min(s.hemY, BODY.floorY) - 60;
    const yFloor = 626;
    const pts: P[] = [
      [CX - s.hemHalf * 0.8, yTop, true],
      [CX - half, yFloor - 6],
      [CX - half * 0.6, yFloor + 4],
      [CX, yFloor + 8],
      [CX + half * 0.6, yFloor + 4],
      [CX + half, yFloor - 6],
      [CX + s.hemHalf * 0.8, yTop, true],
    ];
    pieces.push({
      z: Z.train,
      d: smoothPath(pts, true),
      fill,
      lines: [smoothPath([[CX - half * 0.7, yFloor - 2], [CX - s.hemHalf, s.hemY]]), smoothPath([[CX + half * 0.7, yFloor - 2], [CX + s.hemHalf, s.hemY]])],
      lineWidth: 0.6,
    });
  }

  // Ruffle band below the hem (drawn under the skirt so the skirt covers its top).
  if (extras.ruffleHem) {
    const band = layerPiece({ ...s, volume: Math.min(1, s.volume + 0.5) }, { hemY: s.hemY + 16, hemHalf: s.hemHalf + 10 }, fill, Z.lower - 1, false);
    pieces.push(band);
  }

  for (let i = tiers; i >= 1; i--) {
    const u = i / tiers;
    const hemY = lerp(s.topY + 40, s.hemY, u);
    const hemHalf = tiers === 1 ? s.hemHalf : lerp(torsoHalf(s.topY) + 14, s.hemHalf, u);
    pieces.push(layerPiece(s, { hemY: i === tiers ? s.hemY : hemY, hemHalf }, fill, i === tiers ? Z.lower : Z.tiers + (tiers - i), i === tiers));
  }

  if (extras.fringe) {
    const lines: string[] = [];
    const drop = s.asym * 140;
    for (let x = CX - s.hemHalf + 3; x <= CX + s.hemHalf - 3; x += 3.2) {
      const u = (x - (CX - s.hemHalf)) / (2 * s.hemHalf);
      const y = s.hemY + drop * u + Math.sin(Math.PI * u) * s.hemHalf * 0.1;
      lines.push(`M${x.toFixed(1)} ${(y - 2).toFixed(1)} L${(x + 0.6).toFixed(1)} ${(y + 22 + ((x * 7) % 6)).toFixed(1)}`);
    }
    pieces.push({ z: Z.lower + 2, d: "", fill: "none", lines, lineWidth: 0.9, stroke: 0 });
  }

  return pieces;
}
