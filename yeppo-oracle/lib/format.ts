export const LAUNCH_MC = 27.96; // SOL, market cap of a fresh pump.fun curve

export function usd(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "–";
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `$${(n / 1e3).toFixed(1)}k`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(2)}k`;
  return `$${n.toFixed(0)}`;
}

export function sol(n: number | null | undefined, d = 2) {
  if (n == null || !Number.isFinite(n)) return "–";
  return `${n >= 100 ? n.toFixed(0) : n.toFixed(d)} SOL`;
}

export const pct = (x: number | null | undefined, d = 0) => (x == null || !Number.isFinite(x) ? "–" : `${(x * 100).toFixed(d)}%`);

export function mult(x: number) {
  if (!Number.isFinite(x)) return "–";
  if (x >= 1) return `+${((x - 1) * 100).toFixed(x >= 2 ? 0 : 0)}%`;
  return `−${((1 - x) * 100).toFixed(0)}%`;
}

export function age(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}

/** how long ago, in one unit: 40s, 25m, 3h, 2d */
export function ago(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export const short = (a: string | null | undefined) => (!a ? "–" : a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

export const isMint = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s.trim());

/** a mint from whatever was pasted: the address itself or a link from pump.fun, GMGN, Axiom, Photon, DexScreener… */
export function mintFrom(input: string): string | null {
  const s = input.trim();
  if (isMint(s)) return s;
  const all = s.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) ?? [];
  return all.find((x) => x.endsWith("pump")) ?? all[0] ?? null;
}
