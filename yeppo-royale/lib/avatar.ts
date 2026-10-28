// A character is a handful of part indices. It is stored as JSON on the player and
// rendered as SVG everywhere (lobby, leaderboards, kill feed).
import { rng } from "./rng";

export type Look = { s: number; e: number; m: number; h: number; g: number; o: number; b: number };

export const SKINS = ["#38f28c", "#9b6bff", "#2fd6ff", "#ff9f2e", "#ff5fa8", "#ffd84a", "#ff4d4d", "#4d7bff", "#f4f1ea", "#2b2d36", "#d9a441", "#7ef0d0"];
export const BGS: [string, string][] = [
  ["#3b1d8f", "#120a3a"], ["#0e5bd8", "#071b4f"], ["#d8326e", "#3d0a2a"], ["#0fa36b", "#06301f"], ["#ff8a00", "#5a1d00"],
  ["#11c5e0", "#06364a"], ["#6b6f80", "#16171d"], ["#f5c542", "#5a3d00"], ["#a21caf", "#2a0730"], ["#ef4444", "#3b0909"],
];

export const PARTS = {
  s: { label: "Color", names: SKINS.map((_, i) => `Color ${i + 1}`) },
  e: { label: "Eyes", names: ["Classic", "Happy", "Laser", "Sleepy", "Angry", "Stars", "Money", "Wide"] },
  m: { label: "Mouth", names: ["Smile", "Grin", "Smirk", "Shook", "Tongue", "Flat", "Teeth", "Frown"] },
  h: { label: "Headwear", names: ["None", "Cap", "Beanie", "Crown", "Cowboy", "Headphones", "Top hat", "Horns", "Halo", "Bandana"] },
  g: { label: "Eyewear", names: ["None", "Shades", "Pixel", "Monocle", "Visor", "3D"] },
  o: { label: "Outfit", names: ["None", "Hoodie", "Suit", "Gold chain", "Jersey", "Tank top", "Puffer"] },
  b: { label: "Backdrop", names: BGS.map((_, i) => `Backdrop ${i + 1}`) },
} as const;

export type PartKey = keyof typeof PARTS;
export const PART_KEYS: PartKey[] = ["s", "e", "m", "h", "g", "o", "b"];

export function randomLook(seed?: string | number): Look {
  const r = seed == null ? Math.random : rng(seed);
  const n = (k: PartKey) => Math.floor(r() * PARTS[k].names.length);
  return { s: n("s"), e: n("e"), m: n("m"), h: n("h"), g: r() < 0.55 ? 0 : n("g"), o: n("o"), b: n("b") };
}

export function normLook(x: unknown): Look {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const v = (k: PartKey, d: number) => {
    const n = Math.floor(Number(o[k]));
    return Number.isFinite(n) && n >= 0 && n < PARTS[k].names.length ? n : d;
  };
  return { s: v("s", 0), e: v("e", 0), m: v("m", 0), h: v("h", 0), g: v("g", 0), o: v("o", 0), b: v("b", 0) };
}
