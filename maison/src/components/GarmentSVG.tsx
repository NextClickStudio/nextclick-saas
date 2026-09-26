"use client";

import { useMemo } from "react";
import { renderGarmentSvg, RenderOptions } from "@/lib/garment/render";
import type { GarmentParams } from "@/lib/garment/types";

interface Props extends RenderOptions {
  params: GarmentParams;
  className?: string;
}

/** Draws a garment. The SVG is built as a string, so the exact same drawing can be exported later. */
export function GarmentSVG({ params, className, figure, handDrawn, background }: Props) {
  const svg = useMemo(
    () => renderGarmentSvg(params, { figure, handDrawn, background }),
    [params, figure, handDrawn, background],
  );
  return <div className={`garment ${className ?? ""}`} role="img" aria-label={params.name} dangerouslySetInnerHTML={{ __html: svg }} />;
}
