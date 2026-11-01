// Shared by yeppo.it's server (lib/crowd.ts) and the panel: the crowd's level from its 0-100 interest, and the pump.fun
// numbers the extension reads on pump.fun pages (pump.fun refuses servers) and hands to the panel.

export type PumpStats = { comments: number | null; comments10: number | null; commenters10: number | null; live: boolean; watching: number | null };

export type Level = "Quiet" | "Some interest" | "Growing" | "Lots of eyes" | "Frenzy";

export function levelOf(interest: number, growing: number | null): Level {
  return interest >= 75 ? "Frenzy" : interest >= 55 ? "Lots of eyes" : growing != null && growing >= 1.5 && interest >= 30 ? "Growing" : interest >= 25 ? "Some interest" : "Quiet";
}

const lg = (v: number | null | undefined, full: number) => (v && v > 0 ? Math.min(1, Math.log1p(v) / Math.log1p(full)) : 0);

/** the interest with pump.fun's comments and livestream added (worth 15 and 10 of the 100 points) */
export function withPump(interest: number, pf: PumpStats | null) {
  if (!pf) return interest;
  return Math.min(100, Math.round(interest + lg(pf.comments10, 40) * 15 + lg(pf.watching, 200) * 10));
}
