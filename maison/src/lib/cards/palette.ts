/**
 * Curated fashion colours. The generator never invents random RGB values:
 * every garment is dyed with one of these, so the result always looks "styled".
 * Later the Colour cards will point to these same entries.
 */

export type ColorFamily = "neutral" | "warm" | "cool" | "pastel" | "jewel" | "dark";

export interface FashionColor {
  id: string;
  name: string;
  hex: string;
  family: ColorFamily;
}

export const COLORS: FashionColor[] = [
  // neutrals
  { id: "chalk", name: "Chalk", hex: "#f1ece2", family: "neutral" },
  { id: "ecru", name: "Ecru", hex: "#e3d6bd", family: "neutral" },
  { id: "stone", name: "Stone", hex: "#c9bfae", family: "neutral" },
  { id: "camel", name: "Camel", hex: "#b88a56", family: "neutral" },
  { id: "taupe", name: "Taupe", hex: "#8b7d70", family: "neutral" },
  { id: "silver-grey", name: "Silver Grey", hex: "#b4b3b0", family: "neutral" },
  { id: "charcoal", name: "Charcoal", hex: "#3b3a39", family: "neutral" },
  { id: "noir", name: "Noir", hex: "#191817", family: "dark" },
  // warm
  { id: "butter", name: "Butter Yellow", hex: "#f0dc98", family: "pastel" },
  { id: "mustard", name: "Mustard", hex: "#c8992d", family: "warm" },
  { id: "tangerine", name: "Tangerine", hex: "#e06a2c", family: "warm" },
  { id: "terracotta", name: "Terracotta", hex: "#b65c3d", family: "warm" },
  { id: "rust", name: "Rust", hex: "#94411f", family: "warm" },
  { id: "tomato", name: "Tomato Red", hex: "#d33a2c", family: "warm" },
  { id: "scarlet", name: "Scarlet", hex: "#b0141c", family: "jewel" },
  { id: "cherry", name: "Cherry", hex: "#8c1a2b", family: "jewel" },
  { id: "bordeaux", name: "Bordeaux", hex: "#651828", family: "dark" },
  { id: "oxblood", name: "Oxblood", hex: "#46111a", family: "dark" },
  { id: "chocolate", name: "Chocolate", hex: "#47291e", family: "dark" },
  { id: "mocha", name: "Mocha", hex: "#7a5a48", family: "warm" },
  // pinks & purples
  { id: "blush", name: "Blush", hex: "#e8c4be", family: "pastel" },
  { id: "candy", name: "Candy Pink", hex: "#f0a3bf", family: "pastel" },
  { id: "fuchsia", name: "Fuchsia", hex: "#c0195d", family: "jewel" },
  { id: "lilac", name: "Lilac", hex: "#b8a5cf", family: "pastel" },
  { id: "plum", name: "Plum", hex: "#4d2244", family: "dark" },
  { id: "aubergine", name: "Aubergine", hex: "#361c33", family: "dark" },
  // greens
  { id: "mint", name: "Mint", hex: "#bfe0cc", family: "pastel" },
  { id: "sage", name: "Sage", hex: "#9dab8b", family: "cool" },
  { id: "olive", name: "Olive", hex: "#5d6036", family: "warm" },
  { id: "emerald", name: "Emerald", hex: "#0e6a4d", family: "jewel" },
  { id: "forest", name: "Forest", hex: "#1e3b2b", family: "dark" },
  // blues
  { id: "powder", name: "Powder Blue", hex: "#b6c8da", family: "pastel" },
  { id: "cobalt", name: "Cobalt", hex: "#1f3fa3", family: "jewel" },
  { id: "petrol", name: "Petrol", hex: "#1c4c5c", family: "cool" },
  { id: "teal", name: "Teal", hex: "#1d6d70", family: "cool" },
  { id: "navy", name: "Navy", hex: "#1b2340", family: "dark" },
];

export const colorById = (id: string) => COLORS.find((c) => c.id === id) ?? COLORS[0];

/** Colour weighting by how extreme the garment is: quiet neutrals for commons, drama for legendaries. */
export function colorWeights(intensity: number): [FashionColor, number][] {
  return COLORS.map((c) => {
    const quiet = c.family === "neutral" || c.family === "dark" ? 3 : 1;
    const loud = c.family === "jewel" || c.family === "warm" ? 2.5 : 1;
    return [c, quiet * (1 - intensity) + loud * intensity + 0.3];
  });
}

/* ---------- colour maths ---------- */

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

/** Mix two colours; t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex([ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]);
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const darken = (hex: string, t: number) => mix(hex, "#000000", t);
export const lighten = (hex: string, t: number) => mix(hex, "#ffffff", t);

/** A tone that reads on top of the colour (for pattern ink). */
export const contrastInk = (hex: string, t = 0.45) => (luminance(hex) > 0.45 ? darken(hex, t) : lighten(hex, t));
