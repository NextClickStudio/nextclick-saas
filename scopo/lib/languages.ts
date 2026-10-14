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
  /** Varianti delle ricerche senza AI: {t} = argomento. */
  templates: string[];
};

export const LANGUAGES: Language[] = [
  {
    code: "en",
    label: "English",
    english: "English",
    flag: "🇬🇧",
    region: "US",
    templates: ["{t}", "{t} tutorial", "{t} tips", "how to {t}", "{t} explained", "{t} #shorts"],
  },
  {
    code: "it",
    label: "Italiano",
    english: "Italian",
    flag: "🇮🇹",
    region: "IT",
    templates: ["{t}", "{t} tutorial", "{t} consigli", "{t} spiegato", "{t} #shorts"],
  },
  {
    code: "es",
    label: "Español",
    english: "Spanish",
    flag: "🇪🇸",
    region: "ES",
    templates: ["{t}", "{t} tutorial", "{t} consejos", "{t} explicado", "{t} #shorts"],
  },
  {
    code: "fr",
    label: "Français",
    english: "French",
    flag: "🇫🇷",
    region: "FR",
    templates: ["{t}", "{t} tutoriel", "{t} astuces", "{t} expliqué", "{t} #shorts"],
  },
  {
    code: "de",
    label: "Deutsch",
    english: "German",
    flag: "🇩🇪",
    region: "DE",
    templates: ["{t}", "{t} tutorial", "{t} tipps", "{t} erklärt", "{t} #shorts"],
  },
  {
    code: "pt",
    label: "Português",
    english: "Portuguese",
    flag: "🇧🇷",
    region: "BR",
    templates: ["{t}", "{t} tutorial", "{t} dicas", "{t} explicado", "{t} #shorts"],
  },
  {
    code: "any",
    label: "Any language",
    english: "any language",
    flag: "🌍",
    templates: ["{t}", "{t} tutorial", "{t} tips", "{t} explained", "{t} #shorts"],
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

export function feedHref(topic: string, lang: LangCode): string {
  return `/feed?${new URLSearchParams({ t: topic, lang })}`;
}
