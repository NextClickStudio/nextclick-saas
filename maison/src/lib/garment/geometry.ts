/**
 * Small geometry toolkit for drawing garments as SVG paths.
 * A point is [x, y] or [x, y, true] where `true` means "sharp corner".
 */

export type P = [number, number] | [number, number, boolean];

/** Canvas: 400 x 640, figure centred on x = 200. */
export const W = 400;
export const H = 640;
export const CX = 200;

const f = (n: number) => Math.round(n * 10) / 10;

export const mirrorX = (p: P): P => (p[2] ? [W - p[0], p[1], true] : [W - p[0], p[1]]);
export const mirror = (pts: P[]): P[] => pts.map(mirrorX);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * Smooth path through points (Catmull-Rom converted to cubic Béziers).
 * Points flagged as corners keep a sharp angle.
 */
export function smoothPath(points: P[], closed = false, tension = 1): string {
  const pts = dedupe(points);
  const n = pts.length;
  if (n < 2) return "";
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const get = (i: number) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const k = tension / 6;
    const c1: [number, number] = p1[2] ? [p1[0], p1[1]] : [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2: [number, number] = p2[2] ? [p2[0], p2[1]] : [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? d + " Z" : d;
}

/** Straight polyline. */
export function linePath(points: P[], closed = false): string {
  const d = points.map((p, i) => `${i ? "L" : "M"}${f(p[0])} ${f(p[1])}`).join(" ");
  return closed ? d + " Z" : d;
}

function dedupe(points: P[]): P[] {
  const out: P[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last[0] - p[0]) < 0.01 && Math.abs(last[1] - p[1]) < 0.01) {
      if (p[2]) out[out.length - 1] = p;
      continue;
    }
    out.push(p);
  }
  return out;
}

/** Closed outline from a left half (top → bottom) and its mirror (or a custom right half). */
export function symmetricOutline(left: P[], right?: P[]): P[] {
  const r = right ?? mirror(left);
  return [...left, ...[...r].reverse()];
}

export const circlePath = (cx: number, cy: number, r: number) =>
  `M${f(cx - r)} ${f(cy)} a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0 a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0 Z`;

export const ellipsePath = (cx: number, cy: number, rx: number, ry: number) =>
  `M${f(cx - rx)} ${f(cy)} a${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0 a${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0 Z`;

/** Point along a polyline at parameter t ∈ [0,1], with the unit normal (pointing left of travel). */
export function along(poly: [number, number][], t: number) {
  const lens: number[] = [];
  let total = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    const l = Math.hypot(poly[i + 1][0] - poly[i][0], poly[i + 1][1] - poly[i][1]);
    lens.push(l);
    total += l;
  }
  let dist = clamp(t, 0, 1) * total;
  for (let i = 0; i < lens.length; i++) {
    if (dist <= lens[i] || i === lens.length - 1) {
      const u = lens[i] ? dist / lens[i] : 0;
      const [x0, y0] = poly[i];
      const [x1, y1] = poly[i + 1];
      const dx = (x1 - x0) / (lens[i] || 1);
      const dy = (y1 - y0) / (lens[i] || 1);
      return { x: lerp(x0, x1, u), y: lerp(y0, y1, u), nx: -dy, ny: dx, tx: dx, ty: dy };
    }
    dist -= lens[i];
  }
  const last = poly[poly.length - 1];
  return { x: last[0], y: last[1], nx: 0, ny: 0, tx: 0, ty: 1 };
}

/** Piecewise-smooth interpolation of a profile [[t, value], ...]. */
export function profile(stops: [number, number][], t: number): number {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, v0] = stops[i];
    const [t1, v1] = stops[i + 1];
    if (t <= t1) return lerp(v0, v1, smoothstep((t - t0) / (t1 - t0 || 1)));
  }
  return stops[stops.length - 1][1];
}
