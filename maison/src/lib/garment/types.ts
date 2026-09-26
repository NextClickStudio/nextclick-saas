import type { Rarity } from "@/config/game";

export const GARMENT_TYPES = ["dress", "coat", "jacket", "separates", "trousers", "jumpsuit", "cape"] as const;
export type GarmentType = (typeof GARMENT_TYPES)[number];

export const GARMENT_TYPE_LABELS: Record<GarmentType, string> = {
  dress: "Dress",
  coat: "Coat",
  jacket: "Jacket",
  separates: "Top & Skirt",
  trousers: "Top & Trousers",
  jumpsuit: "Jumpsuit",
  cape: "Cape",
};

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

export type Neckline =
  | "crew"
  | "v"
  | "scoop"
  | "boat"
  | "square"
  | "halter"
  | "strapless"
  | "high"
  | "one-shoulder";

export type SleeveStyle =
  | "none"
  | "cap"
  | "short"
  | "fitted"
  | "bishop"
  | "puff"
  | "mutton"
  | "bell"
  | "balloon"
  | "cascade";

export type Collar = "none" | "shirt" | "peter-pan" | "ruff" | "funnel" | "bow";

export type SkirtShape = "pencil" | "aline" | "full" | "mermaid" | "bubble" | "column" | "tulip";
export type TrouserCut = "cigarette" | "straight" | "wide" | "palazzo" | "culotte" | "balloon" | "flare";
export type Finish = "matte" | "satin" | "metallic" | "iridescent";

export interface TopParams {
  neckline: Neckline;
  /** 0 = fitted, 1 = boxy. */
  fit: number;
  /** Shoulder width multiplier (1 = natural, 2 = dramatic). */
  shoulder: number;
  padded: boolean;
  /** Bottom edge of the top (y). */
  endY: number;
  /** Diagonal draping folds across the bodice, 0..1. */
  drape: number;
  /** Peplum flare width (0 = none). */
  peplum: number;
  cutout: boolean;
}

export interface SkirtParams {
  topY: number;
  shape: SkirtShape;
  hemY: number;
  /** Half width of the hem. */
  hemHalf: number;
  /** Fullness 0..1 (ripples, folds). */
  volume: number;
  tiers: number;
  /** Hem slant 0..1 (right side longer). */
  asym: number;
  slit: "none" | "left" | "right" | "front";
  /** Floor train length 0..1. */
  train: number;
}

export interface TrouserParams {
  cut: TrouserCut;
  hemY: number;
  hemHalf: number;
  kneeHalf: number;
  volume: number;
}

export interface OuterParams {
  kind: "coat" | "jacket" | "cape";
  hemY: number;
  hemHalf: number;
  waistHalf: number;
  shoulder: number;
  padded: boolean;
  /** Front opening gap at the hem (0 = closed). */
  open: number;
  lapel: "none" | "notch" | "shawl" | "funnel";
  doubleBreasted: boolean;
  belted: boolean;
  /** Cocoon roundness 0..1. */
  cocoon: number;
}

export interface SleeveParams {
  style: SleeveStyle;
  /** Volume multiplier. */
  volume: number;
}

export interface DetailParams {
  belt: boolean;
  bow: "none" | "waist" | "neck" | "shoulder";
  buttons: boolean;
  fringe: boolean;
  studs: boolean;
  ruffleHem: boolean;
  pockets: boolean;
}

export interface GarmentParams {
  version: 1;
  seed: string;
  type: GarmentType;
  rarity: Rarity;
  intensity: number;
  name: string;
  colors: { main: string; accent: string; inner: string };
  material: { id: MaterialId; scale: number; angle: number };
  finish: Finish;
  top?: TopParams;
  skirt?: SkirtParams;
  trousers?: TrouserParams;
  outer?: OuterParams;
  /** What the outer layer is worn over (coat, jacket, cape). */
  under?: "dress" | "trousers";
  sleeves: SleeveParams;
  collar: Collar;
  details: DetailParams;
  figure: { hair: "bun" | "bob" | "long" | "crop" | "ponytail"; shoes: "pump" | "boot" | "flat" };
}
