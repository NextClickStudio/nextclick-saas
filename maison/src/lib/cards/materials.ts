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
  "leopard",
  "zebra",
  "snake",
  "camo",
  "argyle",
  "checker",
  "tiedye",
  "lace",
  "mesh",
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
    case "leopard": {
      const rng = createRng(seed + "leopard");
      let spots = "";
      for (let i = 0; i < 7; i++) {
        const x = rng.range(1, 17).toFixed(1);
        const y = rng.range(1, 17).toFixed(1);
        const r = rng.range(1.6, 2.6);
        spots += `<ellipse cx="${x}" cy="${y}" rx="${r.toFixed(1)}" ry="${(r * 0.75).toFixed(1)}" fill="${darken(main, 0.25)}" stroke="${accent}" stroke-width="0.9" stroke-dasharray="3 1.4" transform="rotate(${rng.int(0, 180)} ${x} ${y})"/>`;
      }
      return `<pattern id="${id}-mat" patternUnits="userSpaceOnUse" width="18" height="18" patternTransform="scale(${s.toFixed(2)})">` + spots + close;
    }
    case "zebra":
      return (
        open(16, 16, 20) +
        `<path d="M0 2C4 0 8 5 16 2L16 5C9 7 5 3 0 6Z M0 10C5 8 10 13 16 9L16 12C10 16 5 11 0 14Z" fill="${accent}"/>` +
        close
      );
    case "snake":
      return (
        open(8, 7, 0) +
        `<path d="M0 3.5L4 0L8 3.5L4 7Z" fill="${lighten(main, 0.18)}" stroke="${accent}" stroke-opacity="0.55" stroke-width="0.5"/>` +
        `<path d="M-4 3.5L0 0L4 3.5L0 7ZM4 3.5L8 0L12 3.5L8 7Z" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="0.4"/>` +
        close
      );
    case "camo":
      return (
        open(24, 24, 0) +
        `<path d="M2 3C6 1 9 5 7 8C5 11 1 9 2 3Z M13 2C18 0 22 4 19 7C16 9 12 6 13 2Z M5 14C9 12 14 15 12 19C10 22 4 20 5 14Z M16 13C20 12 23 16 21 19C19 21 15 18 16 13Z" fill="${accent}"/>` +
        `<path d="M9 9C12 8 14 11 12 13C10 14 8 12 9 9Z M19 20C21 19 23 21 22 23C20 24 18 22 19 20Z" fill="${lighten(main, 0.25)}"/>` +
        close
      );
    case "argyle":
      return (
        open(16, 20, 0) +
        `<path d="M8 0L16 10L8 20L0 10Z" fill="${accent}" fill-opacity="0.55"/>` +
        `<path d="M0 0L16 20M16 0L0 20" stroke="${ink}" stroke-opacity="0.5" stroke-width="0.4" stroke-dasharray="1.2 1"/>` +
        close
      );
    case "checker":
      return open(12, 12, 0) + `<rect width="6" height="6" fill="${accent}"/><rect x="6" y="6" width="6" height="6" fill="${accent}"/>` + close;
    case "tiedye":
      return (
        `<pattern id="${id}-mat" patternUnits="userSpaceOnUse" width="60" height="60">` +
        `<circle cx="30" cy="30" r="26" fill="none" stroke="${accent}" stroke-width="7" stroke-opacity="0.55"/>` +
        `<circle cx="30" cy="30" r="12" fill="none" stroke="${lighten(accent, 0.3)}" stroke-width="5" stroke-opacity="0.6"/>` +
        `<circle cx="0" cy="0" r="14" fill="${darken(main, 0.1)}" fill-opacity="0.6"/><circle cx="60" cy="60" r="14" fill="${darken(main, 0.1)}" fill-opacity="0.6"/>` +
        close
      );
    case "lace":
      return (
        open(12, 12, 0) +
        `<circle cx="6" cy="6" r="3.2" fill="none" stroke="${accent}" stroke-width="0.6"/><circle cx="6" cy="6" r="1.1" fill="${accent}"/>` +
        `<path d="M0 0Q3 3 0 6M12 0Q9 3 12 6M0 12Q3 9 0 6M12 12Q9 9 12 6" fill="none" stroke="${accent}" stroke-width="0.5" stroke-opacity="0.8"/>` +
        close
      );
    case "mesh":
      return open(4, 4, 45) + `<path d="M0 0H4M0 0V4" stroke="${accent}" stroke-opacity="0.55" stroke-width="0.35"/>` + close;
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
