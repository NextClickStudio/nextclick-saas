/** Lingue dei video che l'utente può scegliere. "any" = nessun filtro. */
export type LangCode = "any" | "en" | "it" | "es" | "fr" | "de" | "pt";

export type Language = {
  code: LangCode;
  /** Nome nella lingua stessa, mostrato nel selettore. */
  label: string;
  /** Nome in inglese, usato nei prompt e nei testi dell'interfaccia. */
  english: string;
  flag: string;
  /** Paese usato come regionCode nella ricerca YouTube. */
  region?: string;
};

export const LANGUAGES: Language[] = [
  {
    code: "en",
    label: "English",
    english: "English",
    flag: "🇬🇧",
    region: "US",
  },
  {
    code: "it",
    label: "Italiano",
    english: "Italian",
    flag: "🇮🇹",
    region: "IT",
  },
  {
    code: "es",
    label: "Español",
    english: "Spanish",
    flag: "🇪🇸",
    region: "ES",
  },
  {
    code: "fr",
    label: "Français",
    english: "French",
    flag: "🇫🇷",
    region: "FR",
  },
  {
    code: "de",
    label: "Deutsch",
    english: "German",
    flag: "🇩🇪",
    region: "DE",
  },
  {
    code: "pt",
    label: "Português",
    english: "Portuguese",
    flag: "🇧🇷",
    region: "BR",
  },
  {
    code: "any",
    label: "Any language",
    english: "any language",
    flag: "🌍",
  },
];

export const DEFAULT_LANG: LangCode = "en";

export function isLangCode(v: unknown): v is LangCode {
  return typeof v === "string" && LANGUAGES.some((l) => l.code === v);
}

export function getLanguage(code: LangCode): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

/** Lingua del browser (es. "it-IT") → una delle lingue supportate, altrimenti inglese. */
export function langFromLocale(locale: string | undefined): LangCode {
  const base = (locale ?? "").slice(0, 2).toLowerCase();
  return isLangCode(base) && base !== "any" ? base : DEFAULT_LANG;
}

/** "en-US" → "en". YouTube usa codici come "it", "en-GB", "pt-BR". */
export function baseLang(code: string | undefined): string {
  return (code ?? "").slice(0, 2).toLowerCase();
}

/** Link alla "scansione": cosa sai già → percorso su misura. */
export function scanHref(topic: string, lang: LangCode): string {
  return `/path/new?${new URLSearchParams({ t: topic, lang })}`;
}
