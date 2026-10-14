const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/** La YouTube Data API restituisce titoli con entità HTML (es. &#39;). */
export function decodeEntities(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "il", "lo", "la", "i", "gli", "le", "un", "una", "uno", "di", "da", "in", "con", "su",
  "per", "tra", "fra", "e", "ed", "o", "a", "al", "del", "della", "dei", "delle", "come",
  "cosa", "che", "the", "and", "of", "to",
]);

export function keywords(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Filtro anti-rissa / anti-clickbait usato quando la curatela AI non è attiva.
 * Parole tipiche dei video fatti per far arrabbiare, non per informare.
 */
const BAIT_PATTERNS = [
  /\bumili/, /\basfalt/, /\bdistrugg/, /\bblast/, /\bshock/, /\bscandal/,
  /\blitig/, /\brissa/, /\bscontro/, /\bfuori di se\b/, /\bincredibile\b/, /\bnon ci credera/,
  /\bdevi vedere\b/, /\bprank\b/, /\bmeme\b/, /\bdestroy/, /\bowned\b/, /\bgossip/,
];

export function looksLikeBait(title: string): boolean {
  const t = normalize(title);
  if (BAIT_PATTERNS.some((re) => re.test(t))) return true;
  // Titoli quasi tutti in maiuscolo con punti esclamativi multipli.
  const letters = title.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, "");
  return letters.length > 12 && upper.length / letters.length > 0.8 && /!{2,}/.test(title);
}

/** Converte una durata ISO 8601 di YouTube (es. PT1M5S) in secondi. */
export function parseIsoDuration(iso: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  const [, d, h, min, s] = m.map((v) => Number(v ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}
