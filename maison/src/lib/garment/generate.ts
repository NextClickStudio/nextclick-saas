/**
 * The garment generator: seed (+ optional type / rarity) → GarmentParams.
 *
 * Rarity sets an "intensity" (0 = everyday, 1 = runway) and a number of
 * "statement features". Every parameter is pushed further as intensity grows.
 * Same seed + same options = same garment, always.
 */
import { GAME_CONFIG, RARITIES, Rarity } from "@/config/game";
import { colorWeights, COLORS, colorById } from "./palette";
import { createRng, Rng } from "./rng";
import type {
  Collar,
  GarmentParams,
  GarmentType,
  MaterialId,
  Neckline,
  OuterParams,
  SkirtParams,
  SkirtShape,
  SleeveParams,
  SleeveStyle,
  TopParams,
  TrouserCut,
  TrouserParams,
} from "./types";
import { BODY } from "./parts/body";

type Statement =
  | "bigSleeves"
  | "ruff"
  | "train"
  | "volume"
  | "asym"
  | "shoulders"
  | "bigBow"
  | "tiers"
  | "peplum"
  | "cutout"
  | "slit"
  | "fringe"
  | "drape"
  | "cocoon"
  | "funnel"
  | "ruffleHem";

const STATEMENTS: Record<GarmentType, Statement[]> = {
  dress: ["bigSleeves", "ruff", "train", "volume", "asym", "shoulders", "bigBow", "tiers", "peplum", "cutout", "slit", "fringe", "drape", "ruffleHem"],
  separates: ["bigSleeves", "ruff", "volume", "asym", "shoulders", "bigBow", "tiers", "peplum", "slit", "fringe", "ruffleHem", "drape"],
  trousers: ["bigSleeves", "ruff", "volume", "shoulders", "bigBow", "peplum", "drape", "cutout"],
  jumpsuit: ["bigSleeves", "ruff", "volume", "shoulders", "bigBow", "drape", "cutout"],
  coat: ["bigSleeves", "shoulders", "cocoon", "volume", "funnel", "bigBow", "train"],
  jacket: ["bigSleeves", "shoulders", "cocoon", "funnel", "bigBow"],
  cape: ["volume", "funnel", "ruff", "train", "bigBow"],
};

const TYPE_WEIGHTS: [GarmentType, number][] = [
  ["dress", 3],
  ["coat", 1.4],
  ["jacket", 1.2],
  ["separates", 1.5],
  ["trousers", 1.5],
  ["jumpsuit", 0.8],
  ["cape", 0.6],
];

export interface GenerateOptions {
  type?: GarmentType;
  rarity?: Rarity;
}

export function generateGarment(seed: string, opts: GenerateOptions = {}): GarmentParams {
  const rng = createRng(`${seed}|${opts.type ?? "*"}|${opts.rarity ?? "*"}`);
  const cfg = GAME_CONFIG.garment;

  const rarity: Rarity =
    opts.rarity ?? rng.weighted(RARITIES.map((r) => [r, GAME_CONFIG.pack.rarityOdds[r]] as const));
  const type: GarmentType = opts.type ?? rng.weighted(TYPE_WEIGHTS);
  const [iLo, iHi] = cfg.intensity[rarity];
  const I = rng.range(iLo, iHi);

  const [sLo, sHi] = cfg.statementFeatures[rarity];
  const statements = new Set(rng.shuffle(STATEMENTS[type]).slice(0, rng.int(sLo, sHi)));
  // Some statements don't mix well.
  if (statements.has("train") && statements.has("asym")) statements.delete("asym");
  if (statements.has("tiers") && statements.has("peplum")) statements.delete("peplum");
  const has = (s: Statement) => statements.has(s);

  const r = {
    look: rng.fork("look"),
    top: rng.fork("top"),
    lower: rng.fork("lower"),
    outer: rng.fork("outer"),
    detail: rng.fork("detail"),
  };

  // ---------- colour, material, finish ----------
  const main = r.look.weighted(colorWeights(I)).id;
  const accent = pickAccent(r.look, main);
  const inner = r.look.pick(["noir", "chalk", "ecru", "charcoal", "stone"]);
  const material = pickMaterial(r.look, rarity, type);
  let finish: GarmentParams["finish"] = material === "satin" || material === "leather" ? "satin" : "matte";
  if (material === "sequins") finish = "metallic";
  if (r.look.chance(cfg.specialFinishChance[rarity])) {
    // Lamé only on smooth fabrics; iridescence on anything but rustic weaves.
    const smooth = ["plain", "satin", "plisse", "stripes"].includes(material);
    const rustic = ["denim", "knit", "tweed"].includes(material);
    if (smooth && r.look.chance(0.55)) finish = "metallic";
    else if (!rustic) finish = "iridescent";
  }

  // ---------- figure ----------
  const figure: GarmentParams["figure"] = {
    hair: r.look.pick(["bun", "bob", "long", "crop", "ponytail"] as const),
    shoes: r.look.weighted([["pump", 3], ["boot", 1.5], ["flat", 1]] as const),
  };

  // ---------- build by type ----------
  let top: TopParams | undefined;
  let skirt: SkirtParams | undefined;
  let trousers: TrouserParams | undefined;
  let outer: OuterParams | undefined;
  let under: GarmentParams["under"];
  let sleeves: SleeveParams = { style: "none", volume: 1 };
  let collar: Collar = "none";

  const isOuter = type === "coat" || type === "jacket" || type === "cape";

  if (!isOuter) {
    top = makeTop(r.top, I, type, has);
    sleeves = makeSleeves(r.top, I, top.neckline, has);
    collar = makeCollar(r.top, top.neckline, has);
    if (type === "dress" || type === "separates") skirt = makeSkirt(r.lower, I, has);
    else trousers = makeTrousers(r.lower, I, has("volume"));
  } else {
    outer = makeOuter(r.outer, I, type, has);
    under = r.outer.chance(0.5) ? "trousers" : "dress";
    top = { neckline: r.outer.pick(["crew", "high", "v"] as Neckline[]), fit: 0.1, shoulder: 1, padded: false, endY: 250, drape: 0, peplum: 0, cutout: false };
    if (under === "dress") {
      skirt = {
        topY: BODY.waistY,
        shape: r.outer.pick(["pencil", "column"] as SkirtShape[]),
        hemY: Math.min(600, Math.max(430, outer.hemY + r.outer.range(-30, 70))),
        hemHalf: 40,
        volume: 0.15,
        tiers: 1,
        asym: 0,
        slit: "none",
        train: 0,
      };
    } else {
      trousers = makeTrousers(r.outer, 0.1, false);
    }
    if (type !== "cape") {
      sleeves = has("bigSleeves")
        ? { style: r.outer.pick(["balloon", "bell", "mutton", "bishop"] as SleeveStyle[]), volume: r.outer.range(0.8, 1 + 0.5 * I) }
        : { style: "fitted", volume: 1 };
    }
    if (has("ruff")) collar = "ruff";
  }

  const details: GarmentParams["details"] = {
    belt: !isOuter && type !== "trousers" && !top?.peplum && r.detail.chance(0.18 + 0.2 * I),
    bow: has("bigBow") ? r.detail.pick(["waist", "shoulder", "neck"] as const) : r.detail.chance(0.06) ? "waist" : "none",
    buttons: r.detail.chance(0.2),
    fringe: has("fringe"),
    studs: r.detail.chance(0.06 + 0.2 * I),
    ruffleHem: has("ruffleHem"),
    pockets: r.detail.chance(0.3),
  };
  if (outer && details.bow === "waist" && type !== "cape") outer.belted = true;

  const params: GarmentParams = {
    version: 1,
    seed,
    type,
    rarity,
    intensity: Math.round(I * 100) / 100,
    name: "",
    colors: { main, accent, inner },
    material: { id: material, scale: r.look.range(0.8, 1.4), angle: r.look.pick([0, 0, 0, 45, 90, -30]) },
    finish,
    top,
    skirt,
    trousers,
    outer,
    under,
    sleeves,
    collar,
    details,
    figure,
  };
  params.name = nameGarment(params, statements);
  return params;
}

/* ---------------- helpers ---------------- */

function pickAccent(rng: Rng, mainId: string): string {
  const main = colorById(mainId);
  const roll = rng.next();
  if (roll < 0.45) return rng.pick(["noir", "chalk", "ecru"].filter((c) => c !== mainId));
  if (roll < 0.75) {
    const same = COLORS.filter((c) => c.family === main.family && c.id !== mainId);
    if (same.length) return rng.pick(same).id;
  }
  return rng.pick(COLORS.filter((c) => c.id !== mainId)).id;
}

function pickMaterial(rng: Rng, rarity: Rarity, type: GarmentType): MaterialId {
  const patterned = rng.chance(GAME_CONFIG.garment.patternChance[rarity]);
  const tailoring = type === "coat" || type === "jacket";
  if (!patterned) {
    return rng.weighted<MaterialId>([
      ["plain", 5],
      ["satin", tailoring ? 0.5 : 2],
      ["leather", tailoring ? 2 : 0.7],
      ["denim", type === "trousers" || type === "jacket" ? 1.5 : 0.4],
      ["knit", 1],
    ]);
  }
  return rng.weighted<MaterialId>([
    ["stripes", 2],
    ["check", tailoring ? 2 : 1],
    ["houndstooth", tailoring ? 2.5 : 0.7],
    ["polka", tailoring ? 0.3 : 1.5],
    ["floral", tailoring ? 0.4 : 1.5],
    ["plisse", tailoring ? 0.1 : 1.5],
    ["sequins", rarity === "common" ? 0.2 : 1.5],
    ["tweed", tailoring ? 2.5 : 0.6],
  ]);
}

type Has = (s: Statement) => boolean;

function makeTop(rng: Rng, I: number, type: GarmentType, has: Has): TopParams {
  const neckline = rng.weighted<Neckline>([
    ["crew", 3 - I * 2],
    ["v", 2],
    ["scoop", 2],
    ["boat", 1.5],
    ["square", 1],
    ["high", 1 + I],
    ["halter", 0.4 + I],
    ["strapless", 0.4 + I * 1.5],
    ["one-shoulder", 0.2 + I * 1.5],
  ]);
  const shoulders = has("shoulders") && neckline !== "strapless" && neckline !== "halter";
  let endY: number = BODY.waistY;
  if (type === "separates") endY = rng.weighted([[245, 3], [225, 1]] as const);
  if (type === "trousers") endY = rng.weighted([[250, 3], [215, 1], [318, 1.2]] as const);
  if (type === "dress" && rng.chance(0.12)) endY = 268; // drop waist
  return {
    neckline,
    fit: type === "trousers" && endY > 300 ? rng.range(0.4, 0.8) : rng.range(0, 0.35),
    shoulder: shoulders ? rng.range(1.4, 1.6 + 0.6 * I) : rng.range(0.96, 1.04),
    padded: shoulders || rng.chance(0.1),
    endY,
    drape: has("drape") ? rng.range(0.5, 1) : rng.chance(0.12) ? rng.range(0.2, 0.4) : 0,
    peplum: has("peplum") ? rng.range(18, 30 + 45 * I) : 0,
    cutout: has("cutout"),
  };
}

function makeSleeves(rng: Rng, I: number, neckline: Neckline, has: Has): SleeveParams {
  if (neckline === "strapless" || neckline === "halter") return { style: "none", volume: 1 };
  if (has("bigSleeves")) {
    return {
      style: rng.pick(["balloon", "mutton", "puff", "bishop", "cascade", "bell"] as SleeveStyle[]),
      volume: rng.range(0.85, 1 + 0.6 * I),
    };
  }
  return {
    style: rng.weighted<SleeveStyle>([
      ["none", 2],
      ["cap", 1],
      ["short", 2],
      ["fitted", 3],
      ["bishop", 0.6],
      ["puff", 0.6],
      ["bell", 0.5],
    ]),
    volume: rng.range(0.45, 0.85),
  };
}

function makeCollar(rng: Rng, neckline: Neckline, has: Has): Collar {
  if (has("ruff")) return "ruff";
  if (neckline === "crew") return rng.weighted<Collar>([["none", 5], ["shirt", 1.2], ["peter-pan", 0.8], ["bow", 0.5]]);
  if (neckline === "v") return rng.weighted<Collar>([["none", 5], ["shirt", 1], ["bow", 0.4]]);
  if (neckline === "high") return rng.weighted<Collar>([["none", 3], ["funnel", 1]]);
  return "none";
}

function makeSkirt(rng: Rng, I: number, has: Has): SkirtParams {
  let shape: SkirtShape = has("volume")
    ? rng.pick(["full", "full", "bubble", "mermaid"] as SkirtShape[])
    : rng.weighted<SkirtShape>([
        ["pencil", 2],
        ["aline", 3],
        ["column", 1.5],
        ["full", 0.6 + I],
        ["mermaid", 0.5 + I * 0.5],
        ["tulip", 0.6],
        ["bubble", 0.3],
      ]);
  // Tiers only read well on skirts with some flare.
  if (has("tiers") && (shape === "pencil" || shape === "column" || shape === "mermaid" || shape === "tulip")) shape = "aline";
  let hemY = rng.weighted<number>([
    [rng.range(330, 362), shape === "bubble" ? 3 : 1],
    [rng.range(420, 460), 3],
    [rng.range(490, 530), 3],
    [rng.range(572, 600), 2 + I * 3],
  ]);
  if (shape === "mermaid") hemY = Math.max(hemY, 560);
  const train = has("train") ? rng.range(0.4, 0.6 + 0.4 * I) : 0;
  if (train || (shape === "full" && has("volume"))) hemY = Math.max(hemY, 596);

  const hemHalf = Math.min(
    185,
    {
      pencil: 34,
      column: 44,
      aline: rng.range(55, 78),
      full: rng.range(90, 110 + 75 * I),
      mermaid: rng.range(55, 70 + 60 * I),
      bubble: rng.range(62, 82 + 35 * I),
      tulip: rng.range(52, 66),
    }[shape],
  );
  const baseVolume = shape === "full" ? rng.range(0.6, 1) : shape === "aline" || shape === "mermaid" ? rng.range(0.3, 0.6) : rng.range(0.05, 0.25);

  return {
    topY: BODY.waistY,
    shape,
    hemY,
    hemHalf,
    volume: Math.min(1, baseVolume + (has("volume") ? 0.3 : 0)),
    tiers: has("tiers") ? rng.int(2, 2 + Math.round(2 * I)) : 1,
    asym: has("asym") ? rng.range(0.25, 0.3 + 0.4 * I) : 0,
    slit: shape === "mermaid" ? "none" : has("slit") ? rng.pick(["left", "right", "front"] as const) : shape === "pencil" && rng.chance(0.2) ? "right" : "none",
    train,
  };
}

function makeTrousers(rng: Rng, I: number, volume: boolean): TrouserParams {
  const cut: TrouserCut = volume
    ? rng.pick(["palazzo", "balloon", "wide"] as TrouserCut[])
    : rng.weighted<TrouserCut>([
        ["cigarette", 2],
        ["straight", 3],
        ["wide", 2],
        ["culotte", 0.6],
        ["flare", 1],
        ["palazzo", 0.4],
        ["balloon", 0.3],
      ]);
  switch (cut) {
    case "cigarette":
      return { cut, hemY: 575, hemHalf: 8, kneeHalf: 11, volume: 0.1 };
    case "straight":
      return { cut, hemY: 596, hemHalf: 15, kneeHalf: 15, volume: 0.2 };
    case "wide":
      return { cut, hemY: 604, hemHalf: rng.range(28, 36), kneeHalf: 20, volume: 0.5 };
    case "palazzo":
      return { cut, hemY: 606, hemHalf: rng.range(45, 50 + 35 * I), kneeHalf: 30, volume: 0.8 };
    case "culotte":
      return { cut, hemY: 495, hemHalf: 30, kneeHalf: 26, volume: 0.5 };
    case "balloon":
      return { cut, hemY: 575, hemHalf: 8, kneeHalf: rng.range(32, 34 + 20 * I), volume: 0.8 };
    case "flare":
      return { cut, hemY: 604, hemHalf: 30, kneeHalf: 13, volume: 0.3 };
  }
}

function makeOuter(rng: Rng, I: number, type: GarmentType, has: Has): OuterParams {
  const shoulders = has("shoulders");
  const cocoon = has("cocoon") ? rng.range(0.6, 1) : rng.range(0, 0.15);
  if (type === "cape") {
    return {
      kind: "cape",
      hemY: rng.weighted([[rng.range(255, 290), 1.5 - I], [rng.range(420, 480), 1.5], [rng.range(570, 605), 1 + 2 * I]] as const),
      hemHalf: rng.range(82, 100 + (has("volume") ? 80 : 30) * I),
      waistHalf: 0,
      shoulder: 1,
      padded: false,
      open: rng.chance(0.6) ? 1 : 0,
      lapel: has("funnel") ? "funnel" : "none",
      doubleBreasted: false,
      belted: false,
      cocoon: has("volume") ? 1 : cocoon,
    };
  }
  const coat = type === "coat";
  const belted = rng.chance(0.25);
  return {
    kind: coat ? "coat" : "jacket",
    hemY: coat
      ? has("train")
        ? 612
        : rng.range(440, 560 + 40 * I)
      : shoulders && rng.chance(0.45)
        ? 262
        : rng.range(300, 335),
    hemHalf: coat ? rng.range(58, 72) + (has("volume") ? 60 * I : 0) : rng.range(44, 50),
    waistHalf: belted ? 29 : rng.range(36, 44),
    shoulder: shoulders ? rng.range(1.35, 1.5 + 0.35 * I) : rng.range(1.0, 1.08),
    padded: shoulders || rng.chance(0.3),
    open: rng.chance(0.5) ? rng.range(12, 38) : 0,
    lapel: has("funnel") ? "funnel" : rng.weighted([["notch", 3], ["shawl", 1.2], ["none", 1]] as const),
    doubleBreasted: rng.chance(0.3),
    belted,
    cocoon,
  };
}

/* ---------------- naming ---------------- */

const MATERIAL_NAMES: Record<MaterialId, string> = {
  plain: "",
  satin: "Satin",
  leather: "Leather",
  denim: "Denim",
  knit: "Knit",
  stripes: "Stripe",
  check: "Check",
  houndstooth: "Houndstooth",
  polka: "Polka Dot",
  floral: "Floral",
  plisse: "Plissé",
  sequins: "Sequin",
  tweed: "Tweed",
};

function nameGarment(p: GarmentParams, st: Set<Statement>): string {
  const adj: string[] = [];
  if (p.intensity > 0.9) adj.push("Sculpted");
  if (st.has("shoulders")) adj.push("Architectural");
  if (st.has("cocoon")) adj.push("Cocoon");
  if (st.has("asym")) adj.push("Asymmetric");
  if (st.has("tiers")) adj.push("Tiered");
  if (st.has("drape")) adj.push("Draped");
  if (st.has("fringe")) adj.push("Fringed");
  if (st.has("ruffleHem")) adj.push("Ruffled");
  if (st.has("ruff")) adj.push("Ruff-Collar");
  if (st.has("peplum")) adj.push("Peplum");
  if (st.has("bigSleeves") && p.sleeves.style !== "none") adj.push(`${cap(p.sleeves.style)}-Sleeve`);
  if (p.top && ["strapless", "halter", "one-shoulder"].includes(p.top.neckline) && p.type !== "coat") adj.push(titleCase(p.top.neckline));

  let noun: string;
  switch (p.type) {
    case "dress": {
      const s = p.skirt!;
      const shape = { pencil: "Sheath", column: "Column", aline: "A-Line", full: "Ball", mermaid: "Mermaid", bubble: "Bubble", tulip: "Tulip" }[s.shape];
      noun = s.hemY > 570 && (s.shape === "full" || s.train > 0 || s.shape === "mermaid") ? `${shape} Gown` : s.hemY < 370 ? `${shape} Mini Dress` : `${shape} Dress`;
      break;
    }
    case "separates": {
      const s = p.skirt!;
      noun = `${{ pencil: "Pencil", column: "Column", aline: "A-Line", full: "Full", mermaid: "Mermaid", bubble: "Bubble", tulip: "Tulip" }[s.shape]} Skirt Set`;
      break;
    }
    case "trousers":
      noun = `${{ cigarette: "Cigarette", straight: "Straight", wide: "Wide-Leg", palazzo: "Palazzo", culotte: "Culotte", balloon: "Balloon", flare: "Flared" }[p.trousers!.cut]} Trouser Look`;
      break;
    case "jumpsuit":
      noun = `${{ cigarette: "Slim", straight: "", wide: "Wide-Leg", palazzo: "Palazzo", culotte: "Cropped", balloon: "Balloon", flare: "Flared" }[p.trousers!.cut]} Jumpsuit`.trim();
      break;
    case "coat":
      noun = p.outer!.hemY > 590 ? "Opera Coat" : p.outer!.belted ? "Wrap Coat" : p.outer!.doubleBreasted ? "Double-Breasted Coat" : "Coat";
      break;
    case "jacket":
      noun = p.outer!.hemY < 280 ? "Cropped Jacket" : p.outer!.doubleBreasted ? "Double-Breasted Jacket" : "Tailored Jacket";
      break;
    case "cape":
      noun = p.outer!.hemY < 300 ? "Capelet" : "Cape";
      break;
  }

  const color = colorById(p.colors.main).name;
  const finish = p.finish === "metallic" && p.material.id !== "sequins" ? "Lamé" : p.finish === "iridescent" ? "Iridescent" : "";
  const mat = [finish === "Iridescent" ? finish : "", MATERIAL_NAMES[p.material.id], finish === "Lamé" ? finish : ""].filter(Boolean).join(" ");
  const lead = adj.slice(0, 2).join(" ");
  return `${lead ? lead + " " : ""}${noun} in ${color}${mat ? " " + mat : ""}`.replace(/\s+/g, " ");
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const titleCase = (s: string) => s.split("-").map(cap).join("-");
