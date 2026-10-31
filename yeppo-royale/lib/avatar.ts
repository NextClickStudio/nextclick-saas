// A profile picture is a handful of part indices, stored as JSON on the player and
// rendered as a small flat SVG (lobby, standings, live feed).
import { rng } from "./rng";

export type Look = { s: number; e: number; m: number; h: number; g: number; o: number; b: number };

export const FACES = ["#10d48e", "#3d8bff", "#a78bfa", "#f6465d", "#f0b90b", "#22d3ee", "#f472b6", "#e6e8eb", "#fb923c", "#84cc16", "#64748b", "#14b8a6"];
export const BGS = ["#16181d", "#0f2a22", "#0f1d33", "#22163a", "#331419", "#2e2508", "#0b2a30", "#1f2937", "#2a1a10", "#1a2e05"];

export const PARTS = {
  b: { label: "Background", names: BGS.map((_, i) => `Tone ${i + 1}`) },
  s: { label: "Face", names: FACES.map((_, i) => `Color ${i + 1}`) },
  e: { label: "Eyes", names: ["Dots", "Wide", "Lines", "Calm", "Focus", "Squares", "Spark", "Sharp"] },
  m: { label: "Mouth", names: ["Line", "Smile", "Open", "Smirk", "Wide", "Small", "Grin", "Flat"] },
  h: { label: "Top", names: ["None", "Cap", "Beanie", "Crown", "Halo", "Headset", "Horns", "Band", "Antenna", "Star"] },
  g: { label: "Eyewear", names: ["None", "Shades", "Frames", "Visor", "Monocle", "Pixel"] },
  o: { label: "Ring", names: ["None", "White", "Green", "Gold", "Blue", "Double", "Dashed"] },
} as const;

export type PartKey = keyof typeof PARTS;
export const PART_KEYS: PartKey[] = ["b", "s", "e", "m", "h", "g", "o"];

export function randomLook(seed?: string | number): Look {
  const r = seed == null ? Math.random : rng(seed);
  const n = (k: PartKey) => Math.floor(r() * PARTS[k].names.length);
  return { s: n("s"), e: n("e"), m: n("m"), h: r() < 0.5 ? 0 : n("h"), g: r() < 0.6 ? 0 : n("g"), o: r() < 0.5 ? 0 : n("o"), b: n("b") };
}

export function normLook(x: unknown): Look {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const v = (k: PartKey, d: number) => {
    const n = Math.floor(Number(o[k]));
    return Number.isFinite(n) && n >= 0 && n < PARTS[k].names.length ? n : d;
  };
  return { s: v("s", 0), e: v("e", 0), m: v("m", 0), h: v("h", 0), g: v("g", 0), o: v("o", 0), b: v("b", 0) };
}
