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
  // en
  "the", "and", "for", "with", "from", "your", "you", "what", "how", "why", "into", "about",
  // it
  "il", "lo", "la", "gli", "le", "un", "una", "uno", "di", "da", "in", "con", "su", "per", "tra",
  "fra", "ed", "al", "del", "della", "dei", "delle", "come", "cosa", "che", "nel", "nella",
  // es / pt / fr / de
  "el", "los", "las", "del", "con", "para", "como", "que", "por", "les", "des", "une", "pour",
  "avec", "comment", "der", "die", "das", "und", "mit", "wie", "fur", "dos", "das", "uma", "com",
]);

/**
 * Parole generiche che compaiono nelle ricerche ma non dicono di cosa parla il video
 * ("guitar lesson" parla di chitarra, non di "lesson").
 */
const GENERIC = new Set([
  "lesson", "lessons", "tutorial", "tutorials", "tips", "tip", "learn", "learning", "beginner",
  "beginners", "basics", "basic", "course", "explained", "guide", "video", "videos", "shorts",
  "short", "easy", "best", "top", "intro", "introduction", "tricks", "trick", "technique",
  "lezione", "lezioni", "corso", "impara", "imparare", "base", "principianti", "spiegato",
  "spiegata", "guida", "consigli", "facile", "trucchi", "tecnica",
  "aprender", "curso", "clase", "consejos", "explicado", "principiantes", "trucos", "aula", "dicas",
  "iniciantes", "apprendre", "cours", "astuces", "explique", "debutant", "debutants", "lernen",
  "kurs", "tipps", "erklart", "anfanger",
]);

export function keywords(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/** Parole che identificano davvero l'argomento (senza "tutorial", "lesson", ecc.). */
export function topicKeywords(topic: string): string[] {
  return keywords(topic).filter((w) => w.length > 2 && !GENERIC.has(w));
}

/** Radice grossolana: "snowboarding" → "snowboard", "politics" → "polit". */
export function stem(word: string): string {
  return word.length > 6 ? word.slice(0, Math.max(5, word.length - 3)) : word;
}

/** Quante parole dell'argomento compaiono nel testo (titolo, descrizione, tag). */
export function keywordHits(topicWords: string[], text: string): number {
  const haystack = normalize(text);
  return topicWords.filter((w) => haystack.includes(stem(w))).length;
}

/**
 * Filtro anti-rissa / anti-clickbait usato quando la curatela AI non è attiva.
 * Parole tipiche dei video fatti per far arrabbiare, non per informare.
 */
const BAIT_PATTERNS = [
  /\bumili/, /\basfalt/, /\bdistrugg/, /\bblast/, /\bshock/, /\bscandal/,
  /\blitig/, /\brissa/, /\bscontro/, /\bfuori di se\b/, /\bincredibile\b/, /\bnon ci credera/,
  /\bdevi vedere\b/, /\bprank\b/, /\bmeme\b/, /\bdestroy/, /\bowned\b/, /\bgossip/,
  /\byou won t believe\b/, /\bgone wrong\b/, /\bexposed\b/, /\bdrama\b/,
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
