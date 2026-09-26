/** Trousers (and the lower half of jumpsuits). */
import { CX, P, clamp, lerp, mirror, smoothPath, symmetricOutline } from "../geometry";
import type { TrouserParams } from "../types";
import { BODY, torsoHalf } from "./body";
import { FillRef, Piece, Z } from "./piece";

export function buildTrousers(t: TrouserParams, fill: FillRef, topY: number = BODY.waistY): Piece[] {
  const waistHalf = torsoHalf(topY) + 1.5;
  const hipHalf = torsoHalf(BODY.hipY) + 3 + t.volume * 8;
  const legCx = 188 - Math.max(0, t.hemHalf - 11) * 0.9;
  const kneeU = (BODY.kneeY - BODY.hipY) / Math.max(1, t.hemY - BODY.hipY);
  const kneeCx = lerp(181, legCx, clamp(kneeU, 0, 1));
  const kneeY = Math.min(BODY.kneeY, t.hemY - 20);
  const crotchY = BODY.crotchY + (t.cut === "balloon" ? 25 : 0) + (t.cut === "palazzo" ? 10 : 0);

  const outerHem = legCx - t.hemHalf;
  const innerHem = Math.min(CX - 1.5, legCx + t.hemHalf);
  const innerKnee = Math.min(CX - 1.5, kneeCx + t.kneeHalf);

  const left: P[] = [
    [CX - waistHalf, topY, true],
    [CX - hipHalf, BODY.hipY],
    [kneeCx - t.kneeHalf - (t.cut === "palazzo" || t.cut === "wide" ? 6 : 0), kneeY],
    [outerHem, t.hemY, true],
    [lerp(outerHem, innerHem, 0.5), t.hemY + 2],
    [innerHem, t.hemY, true],
    [innerKnee, kneeY],
    [CX, crotchY, true],
  ];
  const outline = smoothPath(symmetricOutline(left, mirror(left)), true);

  const lines: string[] = [];
  // Waistband.
  lines.push(`M${CX - waistHalf} ${topY + 7} L${CX + waistHalf} ${topY + 7}`);
  // Creases or folds.
  const folds = t.hemHalf > 25 ? 3 : 1;
  for (let k = 0; k < folds; k++) {
    const off = folds === 1 ? 0 : lerp(-0.55, 0.55, k / (folds - 1));
    const hx = legCx + t.hemHalf * off;
    const kx = kneeCx + t.kneeHalf * off * 0.6;
    const l = smoothPath([[lerp(CX - hipHalf, CX, 0.45) + off * 6, BODY.hipY + 10], [kx, kneeY], [hx, t.hemY - 2]]);
    lines.push(l);
    lines.push(smoothPath(mirror([[lerp(CX - hipHalf, CX, 0.45) + off * 6, BODY.hipY + 10], [kx, kneeY], [hx, t.hemY - 2]])));
  }
  if (t.cut === "balloon") {
    lines.push(smoothPath([[legCx - 7, t.hemY - 10], [legCx, t.hemY - 14], [legCx + 7, t.hemY - 10]]));
    lines.push(smoothPath(mirror([[legCx - 7, t.hemY - 10], [legCx, t.hemY - 14], [legCx + 7, t.hemY - 10]])));
  }
  // fly
  lines.push(`M${CX} ${topY + 7} L${CX} ${Math.min(crotchY - 6, topY + 60)}`);

  return [{ z: Z.lower, d: outline, fill, lines, lineWidth: 0.6 }];
}
