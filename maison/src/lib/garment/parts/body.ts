/**
 * The croquis: a tall, faceless fashion figure (about 9.5 heads).
 * Every garment part hangs on these anchor points, so hand-drawn parts
 * can replace generated ones later without changing anything else.
 */
import { CX, P, W, ellipsePath, mirror, profile, smoothPath, symmetricOutline } from "../geometry";
import type { GarmentParams } from "../types";

export const BODY = {
  headCy: 72,
  headRx: 20,
  headRy: 27,
  neckY: 125,
  neckHalf: 7,
  shoulderY: 133,
  shoulderHalf: 46,
  armpitY: 163,
  bustY: 182,
  waistY: 238,
  hipY: 300,
  crotchY: 326,
  kneeY: 448,
  ankleY: 586,
  floorY: 608,
  /** Left arm axis: shoulder joint, elbow, wrist, fingertips. */
  arm: [
    [156, 140],
    [141, 238],
    [135, 318],
    [133, 350],
  ] as [number, number][],
} as const;

/** Half width of the torso at a given height. */
export function torsoHalf(y: number): number {
  return profile(
    [
      [BODY.shoulderY, 46],
      [BODY.armpitY, 37],
      [BODY.bustY, 35],
      [BODY.waistY, 24],
      [BODY.hipY, 41],
      [BODY.crotchY, 42],
    ],
    y,
  );
}

/** Arm polyline starting from an arbitrary (garment) shoulder point, mirrored for the right side. */
export function armAxis(shoulder: [number, number], side: "left" | "right"): [number, number][] {
  const rest = BODY.arm.slice(1);
  return [shoulder, ...(side === "left" ? rest : rest.map(([x, y]): [number, number] => [W - x, y]))];
}

export const SKIN = "#d6ccbf";
export const SKIN_LINE = "#b3a595";
export const HAIR = "#161514";

export interface FigureSvg {
  back: string;
  body: string;
  front: string;
}

/** Body silhouette + arms + head + hair + shoes, as three SVG layers. */
export function figureSvg(p: GarmentParams, ink: string, show: boolean): FigureSvg {
  if (!show) return { back: "", body: "", front: "" };

  const left: P[] = [
    [194, 104],
    [193, 124],
    [178, 130],
    [158, 136],
    [161, 165],
    [165, 182],
    [176, 238],
    [159, 300],
    [163, 360],
    [174, 448],
    [173, 505],
    [184, 586],
    [192, 586],
    [195, 505],
    [196, 448],
    [199, 340],
  ];
  const torso = smoothPath(symmetricOutline(left, mirror(left)), true);

  const arm = (side: "left" | "right") => {
    const x = (v: number) => (side === "left" ? v : W - v);
    const pts: P[] = [
      [x(157), 133],
      [x(149), 150],
      [x(136), 238],
      [x(130), 318],
      [x(128), 348],
      [x(134), 352],
      [x(139), 320],
      [x(147), 240],
      [x(160), 170],
    ];
    return smoothPath(pts, true);
  };

  const skinAttrs = `fill="${SKIN}" stroke="${SKIN_LINE}" stroke-width="0.8"`;
  const head = ellipsePath(CX, BODY.headCy, BODY.headRx, BODY.headRy);
  const neck = smoothPath(
    [
      [193, 90],
      [193, 128],
      [207, 128],
      [207, 90],
    ],
    true,
  );

  // Hair
  let hairBack = "";
  let hairFront = "";
  const cap = smoothPath(
    [
      [178, 78],
      [181, 56],
      [200, 43],
      [219, 56],
      [222, 78],
      [214, 62],
      [200, 58],
      [186, 62],
    ],
    true,
  );
  switch (p.figure.hair) {
    case "bun":
      hairFront = cap + " " + ellipsePath(206, 40, 13, 11);
      break;
    case "ponytail":
      hairFront = cap;
      hairBack = smoothPath(
        [
          [214, 52],
          [230, 70],
          [228, 130],
          [222, 170],
          [218, 120],
          [212, 70],
        ],
        true,
      );
      break;
    case "bob":
      hairFront = smoothPath(
        [
          [176, 104],
          [175, 60],
          [200, 42],
          [225, 60],
          [224, 104],
          [217, 100],
          [216, 66],
          [200, 60],
          [184, 66],
          [183, 100],
        ],
        true,
      );
      break;
    case "long":
      hairFront = cap;
      hairBack = smoothPath(
        [
          [178, 70],
          [174, 130],
          [170, 200],
          [186, 190],
          [200, 60],
          [214, 190],
          [230, 200],
          [226, 130],
          [222, 70],
        ],
        true,
      );
      break;
    case "crop":
      hairFront = smoothPath(
        [
          [179, 70],
          [182, 52],
          [200, 44],
          [218, 52],
          [221, 70],
          [212, 58],
          [188, 58],
        ],
        true,
      );
      break;
  }

  // Shoes
  let shoes = "";
  const foot = (side: "left" | "right") => {
    const x = (v: number) => (side === "left" ? v : W - v);
    if (p.figure.shoes === "boot") {
      return smoothPath(
        [
          [x(172), 520],
          [x(183), 588],
          [x(182), 606],
          [x(191), 612, true],
          [x(193), 588],
          [x(196), 520, true],
        ],
        true,
      );
    }
    if (p.figure.shoes === "flat") {
      return smoothPath(
        [
          [x(183), 596],
          [x(181), 606],
          [x(190), 612, true],
          [x(193), 600],
        ],
        true,
      );
    }
    return smoothPath(
      [
        [x(184), 590],
        [x(181), 604],
        [x(186), 608],
        [x(191), 613, true],
        [x(193), 594],
      ],
      true,
    );
  };
  shoes = foot("left") + " " + foot("right");

  return {
    back: hairBack ? `<path d="${hairBack}" fill="${HAIR}"/>` : "",
    body:
      `<path d="${arm("left")}" ${skinAttrs}/><path d="${arm("right")}" ${skinAttrs}/>` +
      `<path d="${neck}" fill="${SKIN}"/><path d="${torso}" ${skinAttrs}/>` +
      `<path d="${shoes}" fill="${ink}"/>`,
    front: `<path d="${head}" ${skinAttrs}/>` + (hairFront ? `<path d="${hairFront}" fill="${HAIR}"/>` : ""),
  };
}
