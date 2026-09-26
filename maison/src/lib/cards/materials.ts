/**
 * Fabric textures as SVG patterns (used by Material cards).
 * Each pattern is a tiny tile repeated over the swatch.
 */
import { createRng } from "../rng";
import { contrastInk, lighten, darken, luminance } from "./palette";

export const MATERIALS = [
  "plain",
  "satin",
  "leather",
  "denim",
  "knit",
  "stripes",
  "check",
  "houndstooth",
  "polka",
  "floral",
  "plisse",
  "sequins",
  "tweed",
] as const;
export type MaterialId = (typeof MATERIALS)[number];

export interface MaterialSpec {
  id: MaterialId;
  scale?: number;
  angle?: number;
}

const INK = "#161514";
const CHALK = "#f3efe7";

export function materialPattern(m: MaterialSpec, id: string, main: string, accent: string, seed: string): string | null {
  const s = m.scale ?? 1;
  const ink = contrastInk(main, 0.4);
  const rot = (angle: number) => `patternTransform="rotate(${angle}) scale(${s.toFixed(2)})"`;
  const open = (w: number, h: number, angle = (m.angle ?? 0)) =>
    `<pattern id="${id}-mat" patternUnits="userSpaceOnUse" width="${w}" height="${h}" ${rot(angle)}>`;
  const close = `</pattern>`;
  switch (m.id) {
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
        open(8, 8, (m.angle ?? 0) === 90 ? 0 : (m.angle ?? 0)) +
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
      const rng = createRng(seed + "tweed");
      const cols = [accent, CHALK, INK, lighten(main, 0.3)];
      let flecks = "";
      for (let i = 0; i < 14; i++) {
        flecks += `<rect x="${rng.range(0, 10).toFixed(1)}" y="${rng.range(0, 10).toFixed(1)}" width="${rng.range(0.8, 2.4).toFixed(1)}" height="${rng.range(0.6, 1.4).toFixed(1)}" fill="${rng.pick(cols)}" fill-opacity="0.75" transform="rotate(${rng.int(-30, 30)})"/>`;
      }
      return `<pattern id="${id}-mat" patternUnits="userSpaceOnUse" width="10" height="10">` + flecks + close;
    }
  }
}
