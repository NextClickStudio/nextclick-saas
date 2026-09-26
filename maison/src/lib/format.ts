/** Number formatting shared by every screen. */
export const UP = "#5fd08a";
export const DOWN = "#ff5a3d";

export const cr = (n: number) => `${Math.round(n).toLocaleString("en-US")} cr`;
export const num = (n: number) => Math.round(n).toLocaleString("en-US");
export const pct = (v: number, digits = 1) => `${v >= 0 ? "▲" : "▼"} ${Math.abs(v * 100).toFixed(digits)}%`;
export const signedPct = (v: number, digits = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(digits)}%`;
export const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
export const tone = (v: number) => (v >= 0 ? UP : DOWN);

/** "3d 4h", "5h 12m", "8m" */
export function timeLeft(ms: number) {
  if (ms <= 0) return "now";
  const m = Math.floor(ms / 60_000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m % 60}m`;
}

/** "just now", "12 min ago", "3 h ago" */
export function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export const vibrate = (p: number | number[]) => {
  try {
    navigator.vibrate?.(p);
  } catch {
    /* not supported */
  }
};
