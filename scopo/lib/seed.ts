import type { Video } from "./types.ts";
import { keywords } from "./text.ts";

/**
 * Argomenti pronti per la modalità demo (senza YOUTUBE_API_KEY).
 * Sono video YouTube reali e pubblici, scelti a mano. Se uno non è più
 * disponibile o non è incorporabile, il player lo salta da solo.
 */
type SeedTopic = {
  label: string;
  emoji: string;
  /** Parole che fanno scattare questo argomento quando l'utente scrive. */
  match: string[];
  videos: Array<Pick<Video, "id" | "title"> & { reason: string }>;
};

export const SEED_TOPICS: SeedTopic[] = [
  {
    label: "Politica italiana",
    emoji: "🏛️",
    match: ["politica", "parlamento", "governo", "costituzione", "partiti", "stato", "elezioni", "senato", "camera"],
    videos: [
      { id: "1FqIsEFT4DQ", title: "Come funziona il sistema politico italiano?", reason: "Le basi del sistema politico in pochi secondi" },
      { id: "xSr0mQl7Qfw", title: "L'articolo 12 della Costituzione Italiana 🇮🇹 #lacostituzioneinshorts", reason: "La Costituzione spiegata articolo per articolo" },
      { id: "pd6nwpsGsBA", title: "La politica italiana spiegata in due minuti", reason: "Panoramica veloce su chi fa cosa" },
      { id: "EQyEFGiEuC4", title: "L'articolo 10 della Costituzione italiana", reason: "Diritti degli stranieri nella Costituzione" },
      { id: "r8pouZD6Wog", title: "Come funziona lo Stato?", reason: "Parlamento, Governo, Presidente e Magistratura" },
      { id: "vjqjFaDZ-1g", title: "L'articolo 11 della Costituzione italiana", reason: "Perché l'Italia ripudia la guerra" },
      { id: "3UFqqsgMxK8", title: "I partiti italiani spiegati facile", reason: "I partiti principali e i loro leader" },
      { id: "CDvPHbf6Sok", title: "Articolo 9 Costituzione italiana: spiegazione e commento", reason: "Cultura e paesaggio nella Costituzione" },
      { id: "HcuuWpzSmTE", title: "Parlamento in breve", reason: "Bicameralismo e iter delle leggi" },
      { id: "Ww-rX3pV_AM", title: "Il Parlamento", reason: "Come nasce una legge" },
      { id: "WX0Avi2j8Gg", title: "Montanelli: onestà, politica e interessi privati", reason: "Un pezzo di storia del giornalismo politico" },
    ],
  },
  {
    label: "Storia",
    emoji: "📜",
    match: ["storia", "storico", "roma", "romani", "guerra", "medioevo", "unita", "risorgimento", "letteratura"],
    videos: [
      { id: "Mth2BL9VfPY", title: "La storia romana in un minuto!", reason: "Dalla fondazione alla caduta di Roma" },
      { id: "lF34xA5awR0", title: "La storia della letteratura italiana: autori, opere e influenza", reason: "Dante, Petrarca, Boccaccio, Machiavelli" },
      { id: "c8fMTcY1Q6U", title: "La storia del pianeta Terra in 1 minuto", reason: "4,5 miliardi di anni in un minuto" },
      { id: "L0XdvKk65Bw", title: "Storia dell'intelligenza artificiale", reason: "Dal test di Turing a oggi" },
      { id: "fGgMMiCI8Fc", title: "L'unità d'Italia (video lezione di storia)", reason: "Come è nata l'Italia unita" },
    ],
  },
  {
    label: "Finanza personale",
    emoji: "💶",
    match: ["finanza", "soldi", "risparmio", "risparmiare", "investire", "investimenti", "economia", "denaro", "borsa", "obbligazioni"],
    videos: [
      { id: "9DG1sKYK8iU", title: "Educazione finanziaria in 4 minuti - Episodio 1", reason: "Perché conviene capire i soldi" },
      { id: "12LMJlc7SXw", title: "Educazione finanziaria per ragazzi: 10 consigli pratici", reason: "Consigli concreti per chi inizia" },
      { id: "za3kQOADqWI", title: "La finanza: finanziamenti e investimenti (Schooltoon)", reason: "I concetti base con un cartone animato" },
      { id: "Yq2sHi-Z21U", title: "Come investire? Introduzione al corso", reason: "Da dove partire per investire" },
      { id: "6kGt0rdASnM", title: "Come investire? Obbligazioni 1", reason: "Cosa sono le obbligazioni" },
    ],
  },
  {
    label: "Scienza",
    emoji: "🔭",
    match: ["scienza", "scienze", "fisica", "chimica", "biologia", "spazio", "universo", "relativita", "quantistica"],
    videos: [
      { id: "jikUCbpGs6o", title: "La teoria della relatività (spiegata in modo semplice!)", reason: "Perché il tempo si dilata" },
      { id: "c8fMTcY1Q6U", title: "La storia del pianeta Terra in 1 minuto", reason: "Geologia ed evoluzione in un colpo d'occhio" },
      { id: "evinJvJDiUM", title: "Storie di scienza - Eureka!", reason: "Le scoperte e chi le ha fatte" },
      { id: "xtxyBr6Xhoo", title: "La fisica quantistica spiegata semplice", reason: "Il mondo dei quanti senza formule" },
    ],
  },
  {
    label: "Inglese",
    emoji: "🇬🇧",
    match: ["inglese", "english", "pronuncia", "lingua", "lingue", "vocabolario", "grammatica"],
    videos: [
      { id: "vaz8DygfhXw", title: "Engineer", reason: "Come si pronuncia davvero \"engineer\"" },
      { id: "0_548ytPJuE", title: "Pronuncia inglese per italiani: ci sono 7 modi per pronunciare la 'A'!", reason: "Il suono che tradisce l'accento italiano" },
      { id: "UVvoivZf1cg", title: "Pronuncia inglese: trucchi pratici ed efficaci per gli italiani", reason: "Trucchi pratici per l'accento" },
      { id: "IbpMWl81i2o", title: "20 frasi utili per chi viaggia in aereo", reason: "Frasi pronte per il prossimo viaggio" },
      { id: "QU56Q36IV5U", title: "Pronuncia inglese per italiani / English accent tips", reason: "Gli errori di pronuncia più comuni" },
    ],
  },
];

export function seedTopicLabels(): string[] {
  return SEED_TOPICS.map((t) => t.label);
}

/** Trova l'argomento demo più vicino a quello scritto dall'utente. */
export function matchSeedTopic(topic: string): SeedTopic | null {
  const words = keywords(topic);
  let best: SeedTopic | null = null;
  let bestScore = 0;
  for (const seed of SEED_TOPICS) {
    const score = words.filter((w) => seed.match.some((m) => w.startsWith(m) || m.startsWith(w))).length;
    if (score > bestScore) {
      best = seed;
      bestScore = score;
    }
  }
  return best;
}

export function seedVideos(seed: SeedTopic): Video[] {
  return seed.videos.map((v) => ({
    id: v.id,
    title: v.title,
    channel: "",
    thumbnail: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
    reason: v.reason,
  }));
}
