const SUB = "₀₁₂₃₄₅₆₇₈₉";

export function fmtUsd(n: number | null | undefined, prefix = "$") {
  if (n == null || !isFinite(n)) return "—";
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1e9) return `${s}${prefix}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}${prefix}${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${s}${prefix}${(a / 1e3).toFixed(1)}K`;
  if (a >= 1e3) return `${s}${prefix}${(a / 1e3).toFixed(2)}K`;
  return `${s}${prefix}${a.toFixed(a >= 10 ? 0 : 2)}`;
}

/** Tiny memecoin prices with subscript zeros: 0.0₅504 */
export function fmtPrice(n: number | null | undefined) {
  if (n == null || !isFinite(n) || n <= 0) return "—";
  if (n >= 1) return `$${n.toFixed(n >= 100 ? 2 : 4)}`;
  if (n >= 0.001) return `$${n.toFixed(5)}`;
  const zeros = Math.ceil(-Math.log10(n)) - 1;
  const digits = Math.round(n * 10 ** (zeros + 4)).toString().slice(0, 4);
  const sub = String(zeros)
    .split("")
    .map((d) => SUB[+d])
    .join("");
  return `$0.0${sub}${digits}`;
}

export function fmtSol(n: number | null | undefined, signed = false) {
  if (n == null || !isFinite(n)) return "—";
  const a = Math.abs(n);
  const digits = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 2 : 3;
  const body = a.toFixed(digits);
  if (signed) return `${n >= 0 ? "+" : "-"}${body}`;
  return n < 0 ? `-${body}` : body;
}

export function fmtPct(n: number | null | undefined) {
  if (n == null || !isFinite(n)) return "—";
  const a = Math.abs(n);
  return `${n >= 0 ? "+" : "-"}${a.toFixed(a >= 100 ? 0 : 1)}%`;
}

export function fmtNum(n: number | null | undefined) {
  if (n == null || !isFinite(n)) return "—";
  return fmtUsd(n, "");
}

export function fmtAge(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}g`;
}

export function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const shortMint = (m: string) => `${m.slice(0, 4)}…${m.slice(-4)}`;

export const tone = (n: number) => (n > 0 ? "up" : n < 0 ? "down" : "flat");

export function hashColor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 90% 60%)`;
}
