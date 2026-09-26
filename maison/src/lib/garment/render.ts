/**
 * Paints a garment as a standalone SVG string (no React needed), so the
 * same function serves the /lab page, the cards and — later — the
 * shareable 9:16 image.
 */
import { assembleGarment } from "./assemble";
import { H, W } from "./geometry";
import { FillRef, Piece } from "./parts/piece";
import { SKIN, figureSvg } from "./parts/body";
import { colorById, contrastInk, darken, lighten, luminance, mix } from "./palette";
import { createRng, hashString } from "./rng";
import type { GarmentParams } from "./types";

export const INK = "#161514";
export const IVORY = "#f4efe6";
const CHALK = "#f3efe7";

export interface RenderOptions {
  /** Draw the croquis (body, head, hair, shoes). */
  figure?: boolean;
  /** Hand-drawn look: wobbly lines, slight colour misregistration, paper grain. */
  handDrawn?: boolean;
  /** Ivory background. */
  background?: boolean;
}

export function renderGarmentSvg(p: GarmentParams, opts: RenderOptions = {}): string {
  const { figure = true, handDrawn = true, background = true } = opts;
  const id = "g" + hashString(JSON.stringify([p.seed, p.type, p.rarity, figure, handDrawn])).toString(36);
  const pieces = assembleGarment(p);

  const main = colorById(p.colors.main).hex;
  let accent = colorById(p.colors.accent).hex;
  if (Math.abs(luminance(accent) - luminance(main)) < 0.08) accent = luminance(main) > 0.5 ? darken(main, 0.55) : lighten(main, 0.6);
  const inner = colorById(p.colors.inner).hex;
  const metalTone = luminance(main) > 0.5 || ["warm", "neutral"].includes(colorById(p.colors.main).family) ? "gold" : "silver";

  const defs: string[] = [];
  const pattern = materialPattern(p, id, main, accent);
  if (pattern) defs.push(pattern);

  // Volume shading, lit from the left.
  defs.push(
    `<linearGradient id="${id}-shade" gradientUnits="userSpaceOnUse" x1="70" y1="0" x2="330" y2="0">` +
      `<stop offset="0" stop-color="#fff" stop-opacity="0.18"/><stop offset="0.4" stop-color="#fff" stop-opacity="0"/>` +
      `<stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.28"/></linearGradient>`,
  );
  // Satin sheen
  defs.push(
    `<linearGradient id="${id}-sheen" x1="0" y1="0" x2="1" y2="1">` +
      [0, 0.22, 0.3, 0.38, 0.58, 0.64, 0.72, 1].map((o, i) => `<stop offset="${o}" stop-color="#fff" stop-opacity="${[0, 0, 0.32, 0, 0, 0.2, 0, 0][i]}"/>`).join("") +
      `</linearGradient>`,
  );
  // Metallic lamé: the colour itself becomes a gradient.
  const metalBase = metalTone === "gold" ? "#c9a24a" : "#b8bcc2";
  const lame = mix(main, metalBase, 0.45);
  defs.push(
    `<linearGradient id="${id}-lame" x1="0" y1="0" x2="1" y2="0.6">` +
      [
        [0, lighten(lame, 0.35)],
        [0.25, lame],
        [0.45, darken(lame, 0.35)],
        [0.6, lighten(lame, 0.45)],
        [0.8, darken(lame, 0.2)],
        [1, lighten(lame, 0.2)],
      ]
        .map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`)
        .join("") +
      `</linearGradient>`,
  );
  defs.push(
    `<linearGradient id="${id}-irid" x1="0" y1="0" x2="1" y2="1">` +
      ["#ffd1ec", "#c6f2ff", "#e6d4ff", "#fff3c4", "#c9ffe6"].map((c, i) => `<stop offset="${i / 4}" stop-color="${c}" stop-opacity="0.55"/>`).join("") +
      `</linearGradient>`,
  );
  defs.push(
    `<radialGradient id="${id}-metal" cx="0.35" cy="0.35" r="0.8"><stop offset="0" stop-color="#fff8dc"/><stop offset="0.5" stop-color="${metalTone === "gold" ? "#c9a24a" : "#aeb3b9"}"/><stop offset="1" stop-color="${metalTone === "gold" ? "#7a5c1c" : "#5d6168"}"/></radialGradient>`,
  );
  if (handDrawn) {
    const n = hashString(p.seed) % 1000;
    defs.push(
      `<filter id="${id}-rough" x="-5%" y="-5%" width="110%" height="110%">` +
        `<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${n}" result="n"/>` +
        `<feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G"/></filter>`,
    );
    defs.push(
      `<filter id="${id}-grain" x="0" y="0" width="100%" height="100%">` +
        `<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="${n}"/>` +
        `<feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0.09 0"/></filter>`,
    );
  }

  const fillHex = (f: FillRef): string => {
    switch (f) {
      case "main":
        return main;
      case "accent":
        return accent;
      case "inner":
        return inner;
      case "ink":
        return INK;
      case "body":
        return SKIN;
      case "chalk":
        return CHALK;
      case "metal":
        return `url(#${id}-metal)`;
      case "none":
        return "none";
    }
  };

  const misreg = handDrawn ? ` transform="translate(1.3 0.9)"` : "";
  const paint = (pc: Piece): string => {
    let s = "";
    if (pc.d && pc.fill !== "none") {
      const isMain = pc.fill === "main";
      const base = isMain && p.finish === "metallic" && p.material.id !== "sequins" ? `url(#${id}-lame)` : fillHex(pc.fill);
      s += `<g${pc.fill === "ink" || pc.fill === "metal" ? "" : misreg}>`;
      s += `<path d="${pc.d}" fill="${base}"/>`;
      if (pattern && (pc.pattern ?? isMain)) s += `<path d="${pc.d}" fill="url(#${id}-mat)"/>`;
      if (isMain && (p.finish === "satin" || p.finish === "metallic")) s += `<path d="${pc.d}" fill="url(#${id}-sheen)"/>`;
      if (isMain && p.finish === "iridescent") s += `<path d="${pc.d}" fill="url(#${id}-irid)" style="mix-blend-mode:soft-light"/><path d="${pc.d}" fill="url(#${id}-sheen)"/>`;
      if (pc.shade !== false) s += `<path d="${pc.d}" fill="url(#${id}-shade)"/>`;
      s += `</g>`;
    }
    const sw = pc.stroke ?? 1.5;
    if (pc.d && sw > 0) s += `<path d="${pc.d}" fill="none" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (pc.lines?.length) {
      const fringe = pc.fill === "none";
      const color = fringe ? darken(main, 0.15) : INK;
      s += `<path d="${pc.lines.join(" ")}" fill="none" stroke="${color}" stroke-width="${pc.lineWidth ?? 0.7}" stroke-opacity="${fringe ? 1 : 0.55}" stroke-linecap="round"/>`;
    }
    return s;
  };

  const fig = figureSvg(p, INK, figure);
  const back = pieces.filter((pc) => pc.z < 10).map(paint).join("");
  const front = pieces.filter((pc) => pc.z >= 10).map(paint).join("");

  const bg = background
    ? `<rect width="${W}" height="${H}" fill="${IVORY}"/>` + (handDrawn ? `<rect width="${W}" height="${H}" filter="url(#${id}-grain)"/>` : "")
    : "";
  const ground = `<ellipse cx="200" cy="614" rx="70" ry="5" fill="#000" fill-opacity="0.07"/>`;
  const content = back + fig.back + fig.body + front + fig.front;
  const body = handDrawn ? `<g filter="url(#${id}-rough)">${content}</g>` : content;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><defs>${defs.join("")}</defs>${bg}${ground}${body}</svg>`;
}

/* ---------------- materials ---------------- */

function materialPattern(p: GarmentParams, id: string, main: string, accent: string): string | null {
  const s = p.material.scale;
  const ink = contrastInk(main, 0.4);
  const rot = (angle: number) => `patternTransform="rotate(${angle}) scale(${s.toFixed(2)})"`;
  const open = (w: number, h: number, angle = p.material.angle) =>
    `<pattern id="${id}-mat" patternUnits="userSpaceOnUse" width="${w}" height="${h}" ${rot(angle)}>`;
  const close = `</pattern>`;
  switch (p.material.id) {
    case "plain":
    case "satin":
    case "leather":
      return null;
    case "stripes":
      return open(12, 12) + `<rect width="4.5" height="12" fill="${accent}"/>` + close;
    case "check":
      return open(14, 14) + `<rect width="7" height="14" fill="${accent}" fill-opacity="0.45"/><rect width="14" height="7" fill="${accent}" fill-opacity="0.45"/>` + close;
    case "houndstooth": {
      const c = luminance(main) > 0.4 ? INK : CHALK;
      return (
        open(8, 8, p.material.angle === 90 ? 0 : p.material.angle) +
        `<path d="M0 0H4V4H0Z M4 4L8 0V2L6 4Z M4 0H6L4 2Z M0 8L4 4V6L2 8Z M0 4H2L0 6Z" fill="${c}"/>` +
        close
      );
    }
    case "polka":
      return open(12, 12, 0) + `<circle cx="3" cy="3" r="1.9" fill="${accent}"/><circle cx="9" cy="9" r="1.9" fill="${accent}"/>` + close;
    case "floral": {
      const petals = [0, 72, 144, 216, 288]
        .map((a) => {
          const r = (a * Math.PI) / 180;
          return `<circle cx="${(9 + Math.cos(r) * 3).toFixed(2)}" cy="${(9 + Math.sin(r) * 3).toFixed(2)}" r="2.3" fill="${accent}"/>`;
        })
        .join("");
      return (
        open(18, 18, 0) +
        petals +
        `<circle cx="9" cy="9" r="1.4" fill="${ink}"/>` +
        `<circle cx="0" cy="0" r="1.6" fill="${ink}" fill-opacity="0.5"/><circle cx="18" cy="18" r="1.6" fill="${ink}" fill-opacity="0.5"/><circle cx="18" cy="0" r="1.6" fill="${ink}" fill-opacity="0.5"/><circle cx="0" cy="18" r="1.6" fill="${ink}" fill-opacity="0.5"/>` +
        close
      );
    }
    case "plisse":
      return (
        `<pattern id="${id}-mat" patternUnits="userSpaceOnUse" width="4" height="4">` +
        `<rect width="1.4" height="4" fill="#000" fill-opacity="0.2"/><rect x="2.2" width="0.7" height="4" fill="#fff" fill-opacity="0.22"/>` +
        close
      );
    case "denim":
      return (
        `<pattern id="${id}-mat" patternUnits="userSpaceOnUse" width="4" height="4">` +
        `<path d="M0 4L4 0M-1 1L1 -1M3 5L5 3" stroke="#fff" stroke-opacity="0.22" stroke-width="0.8"/>` +
        close
      );
    case "knit":
      return (
        `<pattern id="${id}-mat" patternUnits="userSpaceOnUse" width="6" height="5" patternTransform="scale(${s.toFixed(2)})">` +
        `<path d="M0 0.5L3 4.5L6 0.5" fill="none" stroke="${ink}" stroke-opacity="0.35" stroke-width="0.8"/>` +
        close
      );
    case "sequins": {
      const hi = lighten(main, 0.35);
      const lo = darken(main, 0.25);
      const dot = (x: number, y: number) =>
        `<circle cx="${x}" cy="${y}" r="2.3" fill="${hi}" fill-opacity="0.55" stroke="${lo}" stroke-width="0.4"/><circle cx="${x - 0.7}" cy="${y - 0.7}" r="0.6" fill="#fff" fill-opacity="0.7"/>`;
      return `<pattern id="${id}-mat" patternUnits="userSpaceOnUse" width="6" height="6">` + dot(0, 0) + dot(6, 0) + dot(0, 6) + dot(6, 6) + dot(3, 3) + close;
    }
    case "tweed": {
      const rng = createRng(p.seed + "tweed");
      const cols = [accent, CHALK, INK, lighten(main, 0.3)];
      let flecks = "";
      for (let i = 0; i < 14; i++) {
        flecks += `<rect x="${rng.range(0, 10).toFixed(1)}" y="${rng.range(0, 10).toFixed(1)}" width="${rng.range(0.8, 2.4).toFixed(1)}" height="${rng.range(0.6, 1.4).toFixed(1)}" fill="${rng.pick(cols)}" fill-opacity="0.75" transform="rotate(${rng.int(-30, 30)})"/>`;
      }
      return `<pattern id="${id}-mat" patternUnits="userSpaceOnUse" width="10" height="10">` + flecks + close;
    }
  }
}
