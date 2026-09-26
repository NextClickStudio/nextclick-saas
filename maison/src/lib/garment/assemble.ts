/**
 * Turns GarmentParams into an ordered list of pieces (the "pattern cutting").
 */
import { CX, W } from "./geometry";
import { BODY, torsoHalf } from "./parts/body";
import { buildBelt, buildBow, buildCollar, studRow } from "./parts/details";
import { buildOuter } from "./parts/outer";
import { FillRef, Piece, Z } from "./parts/piece";
import { buildSkirt } from "./parts/skirt";
import { buildSleeve } from "./parts/sleeves";
import { buildTop } from "./parts/top";
import { buildTrousers } from "./parts/trousers";
import type { GarmentParams } from "./types";

export function assembleGarment(p: GarmentParams): Piece[] {
  const pieces: Piece[] = [];
  const isOuter = !!p.outer;
  // Under an outer layer, the inner outfit is a quiet plain base.
  const baseFill: FillRef = isOuter ? "inner" : "main";
  const topFill: FillRef = p.type === "separates" || p.type === "trousers" ? "accent" : baseFill;
  const zShift = isOuter ? Z.inner - Z.lower : 0;

  let waistHalf: number = torsoHalf(BODY.waistY) + 2;

  if (p.skirt) {
    const sk = buildSkirt(p.skirt, baseFill, { fringe: p.details.fringe && !isOuter, ruffleHem: p.details.ruffleHem && !isOuter });
    pieces.push(...sk.map((s) => ({ ...s, z: s.z + zShift })));
  }
  if (p.trousers) {
    const trouserFill: FillRef = p.type === "jumpsuit" ? "main" : baseFill;
    pieces.push(...buildTrousers(p.trousers, trouserFill).map((s) => ({ ...s, z: s.z + zShift })));
  }

  if (p.top) {
    const top = buildTop(p.top, isOuter ? "inner" : topFill, isOuter ? Z.inner + 2 : Z.top);
    pieces.push(...top.pieces);
    waistHalf = torsoHalf(BODY.waistY) + 1.5 + p.top.fit * 16;
    if (!isOuter) {
      if (top.shoulderL) {
        const s = buildSleeve(p.sleeves.style, p.sleeves.volume, top.shoulderL, "left", topFill, Z.sleeve);
        if (s) pieces.push(s);
      }
      if (top.shoulderR) {
        const s = buildSleeve(p.sleeves.style, p.sleeves.volume, top.shoulderR, "right", topFill, Z.sleeve);
        if (s) pieces.push(s);
      }
      if (p.details.studs && top.shoulderL) {
        pieces.push(studRow([[top.shoulderL[0] + 4, top.shoulderL[1] + 1], [186, 128]], 5));
        if (top.shoulderR) pieces.push(studRow([[W - 186, 128], [top.shoulderR[0] - 4, top.shoulderR[1] + 1]], 5));
      }
    }
  }

  if (p.outer) {
    const out = buildOuter(p.outer, "main", p.material.id === "plain" && p.outer.kind !== "cape" && p.finish !== "metallic" ? "accent" : "main");
    pieces.push(...out.pieces);
    if (out.shoulderL) {
      const l = buildSleeve(p.sleeves.style, p.sleeves.volume, out.shoulderL, "left", "main", Z.outerSleeve, 3);
      const r = buildSleeve(p.sleeves.style, p.sleeves.volume, out.shoulderR!, "right", "main", Z.outerSleeve, 3);
      if (l) pieces.push(l);
      if (r) pieces.push(r);
    }
    if (p.outer.belted && p.outer.kind !== "cape") pieces.push(...buildBelt(out.waistHalf + 2, false, true).map((b) => ({ ...b, fill: b.fill === "accent" ? ("main" as FillRef) : b.fill, z: b.z + 20 })));
  }

  // Collar
  pieces.push(...buildCollar(p.collar, p.intensity));

  // Belt (dresses / jumpsuits / separates)
  if (p.details.belt && !p.outer) pieces.push(...buildBelt(waistHalf + 1, p.details.studs, false));

  // Bow
  if (p.details.bow !== "none") {
    const big = p.rarity === "epic" || p.rarity === "legendary";
    const s = big ? 1.1 + p.intensity * 1.2 : 0.7;
    if (p.details.bow === "waist") pieces.push(...buildBow(CX + (big ? 18 : 0), BODY.waistY, s));
    if (p.details.bow === "neck") pieces.push(...buildBow(CX, 134, s * 0.85));
    if (p.details.bow === "shoulder") pieces.push(...buildBow(152, 138, s));
  }

  // Buttons down a plain top
  if (p.details.buttons && p.top && !p.outer && ["crew", "high", "v"].includes(p.top.neckline)) {
    const ys = [150, 172, 194, 216].filter((y) => y < p.top!.endY - 8 && (p.top!.neckline !== "v" || y > 185));
    if (ys.length) pieces.push({ z: Z.detail, d: ys.map((y) => `M${CX - 2} ${y} a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 Z`).join(" "), fill: "ink", stroke: 0, shade: false });
  }

  return pieces.sort((a, b) => a.z - b.z);
}
