const SUB = "₀₁₂₃₄₅₆₇₈₉";

const group = (n: number, d: number) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Compact numbers: 1.23K, 4.5M */
export function compact(n: number | null | undefined, d = 1) {
  if (n == null || !isFinite(n)) return "—";
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${s}${(a / 1e3).toFixed(d)}K`;
  return `${s}${group(a, a >= 100 ? 0 : 2)}`;
}

export function pts(n: number | null | undefined) {
  if (n == null || !isFinite(n)) return "—";
  return group(n, Math.abs(n) >= 1000 ? 0 : 2);
}

export function usd(n: number | null | undefined, d = 0) {
  if (n == null || !isFinite(n)) return "—";
  return `${n < 0 ? "-" : ""}$${group(Math.abs(n), d)}`;
}

/** Share price in pts: 4 significant-ish digits */
export function sharePrice(n: number | null | undefined) {
  if (n == null || !isFinite(n)) return "—";
  return n >= 100 ? group(n, 2) : n.toFixed(4);
}

/** Asset price: 81,178.21 · 0.4321 · 0.0₄1234 */
export function assetPrice(n: number | null | undefined) {
  if (n == null || !isFinite(n) || n <= 0) return "—";
  if (n >= 1000) return group(n, 2);
  if (n >= 1) return n.toFixed(n >= 100 ? 2 : 4);
  if (n >= 0.001) return n.toFixed(5);
  const zeros = Math.ceil(-Math.log10(n)) - 1;
  const digits = Math.round(n * 10 ** (zeros + 4))
    .toString()
    .slice(0, 4);
  return `0.0${String(zeros)
    .split("")
    .map((d) => SUB[+d])
    .join("")}${digits}`;
}

export function pct(n: number | null | undefined, d = 2) {
  if (n == null || !isFinite(n)) return "—";
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(d)}%`;
}

export function signed(n: number | null | undefined, f: (x: number) => string = pts) {
  if (n == null || !isFinite(n)) return "—";
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${f(Math.abs(n))}`;
}

export function ago(iso: string | number, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - (typeof iso === "number" ? iso : Date.parse(iso))) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function duration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

export const tone = (n: number | null | undefined) => (n == null || !isFinite(n) || n === 0 ? "flat" : n > 0 ? "up" : "down");
