import type { LangCode } from "./languages.ts";
import type { Video } from "./types.ts";
import { keywords } from "./text.ts";

/**
 * Argomenti pronti per la modalità demo (senza YOUTUBE_API_KEY).
 * Sono video YouTube reali e pubblici, scelti a mano. Se uno non è più
 * disponibile o non è incorporabile, il player lo salta da solo.
 */
export type SeedTopic = {
  label: string;
  emoji: string;
  lang: Exclude<LangCode, "any">;
  /** Parole (in più lingue) che fanno scattare questo argomento. */
  match: string[];
  videos: Array<Pick<Video, "id" | "title"> & { reason: string }>;
};

export const SEED_TOPICS: SeedTopic[] = [
  {
    label: "Guitar",
    emoji: "🎸",
    lang: "en",
    match: ["guitar", "guitars", "chitarra", "guitarra", "guitare", "gitarre", "chord", "chords", "accordi"],
    videos: [
      { id: "CTOyMUhOr1U", title: "🎸 Easy Guitar Chords You Must Learn!", reason: "The first chords worth learning" },
      { id: "XqXOxVjFVb0", title: "Learn this on guitar to not sound like a beginner", reason: "A lick that levels up your playing" },
      { id: "FxUYrgl17BI", title: "Top 10 Beginner Guitar Tips (after teaching for 20+ years)", reason: "Habits that make practice pay off" },
      { id: "4jowDNNDId0", title: "How to Actually Learn Guitar (What Most Beginners Get Wrong)", reason: "The mistakes that slow beginners down" },
    ],
  },
  {
    label: "Snowboarding",
    emoji: "🏂",
    lang: "en",
    match: ["snowboard", "snowboarding", "ollie", "nollie"],
    videos: [
      { id: "Nti8RzGevAM", title: "Master the Ollie (Snowboarding Edition) 🏂", reason: "The ollie, the base of every trick" },
      { id: "cAy893oaVqE", title: "How To Ollie? 🧠", reason: "Pop off the tail, step by step" },
      { id: "UH-MBmg6kZg", title: "Learn to Ollie Frontside 180 on your Snowboard", reason: "Your next trick after the ollie" },
      { id: "D5sEJRx6QUY", title: "How to Ollie like a Pro: the simplest trick on a snowboard", reason: "Timing and body position for the ollie" },
      { id: "H_tSuAipjWc", title: "Snowboard Trick Tips: Ollie and Nollie", reason: "Ollie vs nollie, explained" },
      { id: "FddSvABDPgg", title: "This Video Will Improve Your Ollies", reason: "Get more height out of your ollies" },
      { id: "2VLsnhM9O5k", title: "Introduction to Ollies and Ollie 180s!", reason: "Beginner drills for ollies and 180s" },
    ],
  },
  {
    label: "Skiing",
    emoji: "⛷️",
    lang: "en",
    match: ["ski", "skiing", "skier", "sciare", "carving", "carve", "esqui", "skifahren"],
    videos: [
      { id: "dZVKJZ0fsvo", title: "How to carve on steep runs? 👇", reason: "Bend the ski for a tighter arc" },
      { id: "LrmCNarCzIY", title: "How to Carve on Skis", reason: "How a ski actually carves the snow" },
      { id: "nh0YYFXsiUw", title: "How to Carve on Skis Smoothly", reason: "Smoother, cleaner carved turns" },
      { id: "ihs5gT-WM6Q", title: "Advanced Carving Tips", reason: "Three drills to level up your carving" },
      { id: "2WKfNm_lflk", title: "How to Carve", reason: "Carving tips from an Olympic racer" },
    ],
  },
  {
    label: "Chess",
    emoji: "♟️",
    lang: "en",
    match: ["chess", "scacchi", "ajedrez", "echecs", "schach", "xadrez"],
    videos: [
      { id: "XnD6LlDPeAw", title: "A Mind-blowing Trap", reason: "An opening trap to know (and avoid)" },
      { id: "sozQmM1x5xU", title: "Top Secret Chess Opening Trap!", reason: "A sneaky trap from the opening" },
      { id: "feSldJjPRjY", title: "English Opening Trap", reason: "A trap from the English Opening" },
      { id: "V2C2P2jzKeM", title: "Nimzo-Larsen Trap: Chess Opening Tricks to Win Fast", reason: "A trap seen in a grandmaster game" },
      { id: "E3tqoxBGmko", title: "Win in 7 Moves", reason: "How fast a game can be over" },
    ],
  },
  {
    label: "Cooking",
    emoji: "🔪",
    lang: "en",
    match: ["cooking", "cook", "cucina", "cucinare", "knife", "coltello", "chef", "kitchen", "cocina"],
    videos: [
      { id: "SkvdstYH15k", title: "Knife Skills - How To Use A Chef Knife", reason: "How to hold and use a chef's knife" },
      { id: "YrHpeEwk_-U", title: "9 Essential Knife Skills To Master", reason: "The cuts every cook uses" },
      { id: "QlCBG3_M060", title: "Basic Knife Skills: How to Chop 3x Faster", reason: "Chop faster, and more safely" },
      { id: "Obe8idEt9qA", title: "The 10 Knife Skills Every Chef Needs to Learn", reason: "Ten techniques from pro kitchens" },
    ],
  },
  {
    label: "Italian politics",
    emoji: "🏛️",
    lang: "it",
    match: ["politics", "political", "politica", "parlamento", "parliament", "governo", "costituzione", "constitution", "partiti", "elezioni", "senato"],
    videos: [
      { id: "1FqIsEFT4DQ", title: "Come funziona il sistema politico italiano?", reason: "Italy's political system in seconds" },
      { id: "xSr0mQl7Qfw", title: "L'articolo 12 della Costituzione Italiana 🇮🇹 #lacostituzioneinshorts", reason: "The Constitution, one article at a time" },
      { id: "pd6nwpsGsBA", title: "La politica italiana spiegata in due minuti", reason: "Who does what, in two minutes" },
      { id: "EQyEFGiEuC4", title: "L'articolo 10 della Costituzione italiana", reason: "Foreigners' rights in the Constitution" },
      { id: "r8pouZD6Wog", title: "Come funziona lo Stato?", reason: "Parliament, Government, President, courts" },
      { id: "vjqjFaDZ-1g", title: "L'articolo 11 della Costituzione italiana", reason: "Why Italy rejects war" },
      { id: "3UFqqsgMxK8", title: "I partiti italiani spiegati facile", reason: "The main parties and their leaders" },
      { id: "CDvPHbf6Sok", title: "Articolo 9 Costituzione italiana: spiegazione e commento", reason: "Culture and landscape in the Constitution" },
      { id: "HcuuWpzSmTE", title: "Parlamento in breve", reason: "Two chambers and how laws pass" },
      { id: "Ww-rX3pV_AM", title: "Il Parlamento", reason: "How a law is born" },
    ],
  },
  {
    label: "History",
    emoji: "📜",
    lang: "it",
    match: ["history", "storia", "historia", "histoire", "geschichte", "roma", "rome", "roman", "romani"],
    videos: [
      { id: "Mth2BL9VfPY", title: "La storia romana in un minuto!", reason: "Ancient Rome, from founding to fall" },
      { id: "lF34xA5awR0", title: "La storia della letteratura italiana: autori, opere e influenza", reason: "Dante, Petrarch, Boccaccio, Machiavelli" },
      { id: "c8fMTcY1Q6U", title: "La storia del pianeta Terra in 1 minuto", reason: "4.5 billion years in a minute" },
      { id: "L0XdvKk65Bw", title: "Storia dell'intelligenza artificiale", reason: "From the Turing test to today" },
      { id: "fGgMMiCI8Fc", title: "L'unità d'Italia (video lezione di storia)", reason: "How Italy became one country" },
    ],
  },
  {
    label: "Personal finance",
    emoji: "💶",
    lang: "it",
    match: ["finance", "finanza", "money", "soldi", "saving", "risparmio", "investing", "investire", "investimenti", "economia", "bonds", "obbligazioni"],
    videos: [
      { id: "9DG1sKYK8iU", title: "Educazione finanziaria in 4 minuti - Episodio 1", reason: "Why understanding money pays off" },
      { id: "12LMJlc7SXw", title: "Educazione finanziaria per ragazzi: 10 consigli pratici", reason: "Ten practical money tips" },
      { id: "za3kQOADqWI", title: "La finanza: finanziamenti e investimenti (Schooltoon)", reason: "The basics, as a cartoon" },
      { id: "Yq2sHi-Z21U", title: "Come investire? Introduzione al corso", reason: "Where to start with investing" },
      { id: "6kGt0rdASnM", title: "Come investire? Obbligazioni 1", reason: "What bonds are" },
    ],
  },
  {
    label: "Physics",
    emoji: "🔭",
    lang: "it",
    match: ["physics", "fisica", "science", "scienza", "relativity", "relativita", "quantum", "quantistica", "universe", "universo"],
    videos: [
      { id: "jikUCbpGs6o", title: "La teoria della relatività (spiegata in modo semplice!)", reason: "Why time stretches" },
      { id: "xtxyBr6Xhoo", title: "La fisica quantistica spiegata semplice", reason: "The quantum world, no formulas" },
      { id: "evinJvJDiUM", title: "Storie di scienza - Eureka!", reason: "Discoveries and the people behind them" },
    ],
  },
];

export function seedSuggestions(): Array<{ topic: string; lang: SeedTopic["lang"]; emoji: string }> {
  return SEED_TOPICS.map((t) => ({ topic: t.label, lang: t.lang, emoji: t.emoji }));
}

function wordMatches(w: string, m: string): boolean {
  return w === m || (m.length >= 5 && w.startsWith(m)) || (w.length >= 5 && m.startsWith(w));
}

/** Trova l'argomento demo più vicino a quello scritto dall'utente. */
export function matchSeedTopic(topic: string): SeedTopic | null {
  const words = keywords(topic);
  let best: SeedTopic | null = null;
  let bestScore = 0;
  for (const seed of SEED_TOPICS) {
    const score = words.filter((w) => seed.match.some((m) => wordMatches(w, m))).length;
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
