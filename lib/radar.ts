// Radar: ogni giorno legge su Instagram (API ufficiale) i nuovi post dei brand che segui e degli hashtag
// del tuo settore; l'AI tiene solo quelli in cui un tuo commento o messaggio ha senso.

export type RadarProfile = {
  /** settori / tipi di aziende target (servono all'AI per capire cosa è rilevante) */
  sectors: string[];
  /** argomenti e problemi legati a quello che vendi */
  topics: string[];
  /** profili Instagram dei brand da seguire (senza @) */
  igBrands: string[];
  /** hashtag da monitorare (senza #), massimo 30 diversi a settimana */
  igHashtags: string[];
  /** brand nuovi scoperti in automatico dal Radar (monitorati ogni giorno) */
  igDiscovered: string[];
  /** brand che l'utente non vuole vedere */
  igIgnored: string[];
};

export const MAX_HASHTAGS = 10;
export const MAX_BRANDS = 40;
export const MAX_DISCOVERED = 60;

/** Profilo letto dal database, con valori sicuri. */
export function readProfile(raw: unknown): RadarProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<RadarProfile>;
  const list = (v: unknown, max: number) =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()))].slice(0, max) : [];
  const profile = {
    sectors: list(r.sectors, 8),
    topics: list(r.topics, 12),
    igBrands: list(r.igBrands, MAX_BRANDS).map((x) => x.replace(/^@/, "").toLowerCase()),
    igHashtags: list(r.igHashtags, MAX_HASHTAGS).map((x) => x.replace(/^#/, "").toLowerCase()),
    igDiscovered: list(r.igDiscovered, MAX_DISCOVERED).map((x) => x.toLowerCase()),
    igIgnored: list(r.igIgnored, 500).map((x) => x.toLowerCase()),
  };
  return profile.sectors.length > 0 || profile.igBrands.length > 0 || profile.igHashtags.length > 0 ? profile : null;
}

/** Solo post Instagram (post, reel). */
export function isInstagramPost(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") === "instagram.com" && /^\/(p|reel|reels|tv)\//.test(u.pathname);
  } catch {
    return false;
  }
}
