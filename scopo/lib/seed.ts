import type { LangCode } from "./languages.ts";
import type { PlanStep } from "./paths.ts";
import type { Video } from "./types.ts";
import { keywords } from "./text.ts";

/**
 * Percorsi pronti per la modalità demo (senza YOUTUBE_API_KEY).
 * Video YouTube reali e pubblici, scelti a mano e messi in ordine.
 * Se uno non è più disponibile o non è incorporabile, il player lo salta.
 */
type SeedVideo = { id: string; title: string; reason: string };

type SeedStep = { title: string; summary: string; keywords: string[]; videos: SeedVideo[] };

export type SeedTopic = {
  label: string;
  emoji: string;
  lang: Exclude<LangCode, "any">;
  /** Parole (in più lingue) che fanno scattare questo argomento. */
  match: string[];
  steps: SeedStep[];
};

export const SEED_TOPICS: SeedTopic[] = [
  {
    label: "Guitar",
    emoji: "🎸",
    lang: "en",
    match: ["guitar", "guitars", "chitarra", "guitarra", "guitare", "gitarre"],
    steps: [
      {
        title: "Get set up",
        summary: "Tune your guitar and hold the pick the right way",
        keywords: ["tune", "tuning", "accordare", "pick", "plettro", "hold"],
        videos: [
          { id: "kZ9T749GF1o", title: "How to tune a guitar (standard tuning)", reason: "Standard tuning, string by string" },
          { id: "ckF8CI9JApU", title: "3 Easy Ways to Tune Your Guitar 🎸", reason: "App, clip-on or pedal: pick a tuner" },
          { id: "CiKK7YzM95E", title: "How to Hold and Play With a Guitar Pick", reason: "A relaxed pick grip that doesn't slip" },
        ],
      },
      {
        title: "Your first chords",
        summary: "The open chords that most songs are built on",
        keywords: ["chord", "chords", "accordi", "accordo", "open chords"],
        videos: [
          { id: "CTOyMUhOr1U", title: "🎸 Easy Guitar Chords You Must Learn!", reason: "The first chords worth learning" },
          { id: "akjGZk_RCEU", title: "4 Chords & Easy Strumming Pattern For Beginners", reason: "Four chords that play hundreds of songs" },
        ],
      },
      {
        title: "Clean chord changes",
        summary: "Switch between chords without the awkward pause",
        keywords: ["change", "changes", "changing", "switch", "transition", "cambi", "cambiare"],
        videos: [
          { id: "c6XMz0-tLWU", title: "How to Fix Your Chord Changes FAST", reason: "Fix the pause between chords" },
          { id: "MO6HLU06L4c", title: "Faster Chord Changes Tip #1: Pivot (Anchor) Fingers", reason: "Anchor fingers that stay put" },
          { id: "xj64a6S1s5M", title: "Faster Chord Changes Tip #6: Slow Down To Speed Up", reason: "Why slow practice makes you faster" },
        ],
      },
      {
        title: "Strumming patterns",
        summary: "Keep a steady rhythm with simple patterns",
        keywords: ["strum", "strumming", "rhythm", "ritmo", "pennata"],
        videos: [
          { id: "uqEofjyPZHk", title: "Essential Strumming Pattern for Guitar Beginners!", reason: "The one pattern to learn first" },
          { id: "nQD_GNZ9O10", title: "Guitar strumming pattern for beginners", reason: "Down strums with a steady pulse" },
          { id: "Kb7hnTbCPng", title: "Mastering Guitar Strumming Patterns", reason: "Break strumming down, then build up" },
        ],
      },
      {
        title: "Barre chords",
        summary: "Make the F chord finally ring clean",
        keywords: ["barre", "bar chord", "barre chords", "barrè", "barre chord", "f chord"],
        videos: [
          { id: "R45_3nJxOjs", title: "Barre Chord Tip: DON'T Barre…", reason: "Get the shape before the barre" },
          { id: "bN6cB040IyY", title: "MOVE YOUR THUMB: Barre Chord Essential Technique", reason: "Thumb position does half the work" },
          { id: "BR7iHayA4VU", title: "Barre Chords Get Easier When You Do THIS!", reason: "Use the side of your finger, not force" },
          { id: "D2pS95q6lvk", title: "Learn a Guitar F Barre Chord in 1 Minute", reason: "The F barre chord, step by step" },
        ],
      },
      {
        title: "Fingerpicking",
        summary: "Pick patterns that sound beautiful",
        keywords: ["fingerpicking", "fingerstyle", "arpeggio", "arpeggi", "travis"],
        videos: [
          { id: "l2A2Eoh1Dpk", title: "Fingerpicking Basics Every Guitarist Needs", reason: "The foundation exercise first" },
          { id: "rva-Xohydw0", title: "Super Easy & Beautiful Beginner Fingerpicking Pattern", reason: "A simple pattern that sounds great" },
          { id: "b6c6vFRP2ow", title: "The Fastest Way to Fingerpick!", reason: "Travis picking, the classic pattern" },
        ],
      },
      {
        title: "Sound less like a beginner",
        summary: "Habits and licks that level up your playing",
        keywords: ["lick", "licks", "solo", "improvise", "songs", "canzoni"],
        videos: [
          { id: "XqXOxVjFVb0", title: "Learn this on guitar to not sound like a beginner", reason: "A lick that levels up your playing" },
          { id: "FxUYrgl17BI", title: "Top 10 Beginner Guitar Tips (after teaching for 20+ years)", reason: "Habits that make practice pay off" },
          { id: "4jowDNNDId0", title: "How to Actually Learn Guitar (What Most Beginners Get Wrong)", reason: "The mistakes that slow beginners down" },
        ],
      },
    ],
  },
  {
    label: "Snowboarding",
    emoji: "🏂",
    lang: "en",
    match: ["snowboard", "snowboarding", "ollie", "nollie"],
    steps: [
      {
        title: "Find your stance",
        summary: "Regular or goofy, and why it matters",
        keywords: ["stance", "regular", "goofy", "bindings", "attacchi"],
        videos: [
          { id: "45XqV6QFA20", title: "Regular or Goofy? How to Figure Out Your Snowboard Stance", reason: "Find out which foot goes forward" },
        ],
      },
      {
        title: "Edges & side-slipping",
        summary: "Control your speed on the heel and toe edge",
        keywords: ["edge", "edges", "heel", "toe", "side slip", "sideslip", "lamina", "slide"],
        videos: [
          { id: "Su2wKCdv3Fo", title: "Snowboard Tutorial: Switching from Heel to Toe Edge", reason: "Move from heel edge to toe edge" },
          { id: "FD8hLLPTVP0", title: "Side-Slipping Heel Edge and Toe Edge", reason: "The drill that keeps you in control" },
          { id: "_B0XJKNws00", title: "How To Avoid Heel Edge Chatter", reason: "Stop the board from chattering" },
        ],
      },
      {
        title: "Linking turns",
        summary: "From C-turns to smooth S-turns down the slope",
        keywords: ["turn", "turns", "linking", "link", "carve", "curve", "s turns"],
        videos: [
          { id: "tnfCvEzSX5U", title: "How to Link Turns Snowboarding // under a minute", reason: "Linking turns, in under a minute" },
          { id: "bX-5rpqaLd8", title: "Snowboard Basics: Linking Turns", reason: "Weight shift and rhythm for turns" },
          { id: "WQNU5xG4tr4", title: "How to Link Turns on Snowboard: The S Turns", reason: "From C-turns to S-turns" },
        ],
      },
      {
        title: "The ollie",
        summary: "Pop off the tail, the base of every trick",
        keywords: ["ollie", "jump", "pop", "salto"],
        videos: [
          { id: "Nti8RzGevAM", title: "Master the Ollie (Snowboarding Edition) 🏂", reason: "The ollie, the base of every trick" },
          { id: "cAy893oaVqE", title: "How To Ollie? 🧠", reason: "Pop off the tail, step by step" },
          { id: "D5sEJRx6QUY", title: "How to Ollie like a Pro: the simplest trick on a snowboard", reason: "Timing and body position for the ollie" },
        ],
      },
      {
        title: "Ollie & nollie",
        summary: "More height, and popping off the nose too",
        keywords: ["nollie", "higher ollie"],
        videos: [
          { id: "H_tSuAipjWc", title: "Snowboard Trick Tips: Ollie and Nollie", reason: "Ollie vs nollie, explained" },
          { id: "FddSvABDPgg", title: "This Video Will Improve Your Ollies", reason: "Get more height out of your ollies" },
        ],
      },
      {
        title: "Butters",
        summary: "Press, spin and play on flat ground",
        keywords: ["butter", "butters", "press", "nose press", "tail press"],
        videos: [
          { id: "Eu3oP8810Q0", title: "How to butter on a Snowboard", reason: "Body and edge awareness through butters" },
          { id: "5DleDp-87XY", title: "How to Butter on a Snowboard", reason: "Your first nose and tail butters" },
          { id: "iapdTJxELMs", title: "BUTTERING 101: How to Butter a Snowboard", reason: "Butter, nose press and tail press" },
        ],
      },
      {
        title: "Your first 180",
        summary: "Spin half a turn and ride away clean",
        keywords: ["180", "spin", "spins", "rotation"],
        videos: [
          { id: "2VLsnhM9O5k", title: "Introduction to Ollies and Ollie 180s!", reason: "From ollie to ollie 180" },
          { id: "UH-MBmg6kZg", title: "Learn to Ollie Frontside 180 on your Snowboard", reason: "Your next trick after the ollie" },
        ],
      },
    ],
  },
  {
    label: "Chess",
    emoji: "♟️",
    lang: "en",
    match: ["chess", "scacchi", "ajedrez", "echecs", "schach", "xadrez"],
    steps: [
      {
        title: "How the pieces move",
        summary: "Every piece, and the special moves",
        keywords: ["pieces", "moves", "rules", "regole", "pezzi", "castling", "arrocco"],
        videos: [
          { id: "oIL-M0H53bM", title: "How To Move Pieces In Chess (Correct Way!)", reason: "A quick tour of every piece" },
          { id: "1Dn0C2X32n0", title: "Chess Lesson 1: How to Move the Pieces!", reason: "The full rules for each piece" },
        ],
      },
      {
        title: "Opening principles",
        summary: "Control the centre, develop, castle early",
        keywords: ["opening", "openings", "aperture", "apertura", "centre", "center", "develop"],
        videos: [
          { id: "hTWgmQmjcH4", title: "Five Rules Of Chess Openings", reason: "Five rules for any opening" },
          { id: "MEKpsSrccts", title: "Magnus: The Best Opening for Beginners 😇", reason: "Which opening to start with" },
          { id: "kURU67G98O8", title: "Chess Basics: Opening Principles", reason: "Centre, development and king safety" },
        ],
      },
      {
        title: "Forks & pins",
        summary: "Win material with the two most common tactics",
        keywords: ["fork", "forks", "pin", "pins", "tactic", "tactics", "tattiche", "skewer"],
        videos: [
          { id: "CO0NrCI-DoU", title: "Forks! 🍴 Beginner chess tactic explained!", reason: "One piece, two targets" },
          { id: "0J9L17KuggU", title: "Exploiting a Terminal Pin", reason: "Attack the piece that can't move" },
          { id: "qMfXy648KIY", title: "Chess pins, skewers and forks explained", reason: "Pins, skewers and forks side by side" },
        ],
      },
      {
        title: "Back-rank mate",
        summary: "The checkmate pattern you'll see most often",
        keywords: ["checkmate", "mate", "scacco matto", "back rank"],
        videos: [
          { id: "dZrEQjX84dQ", title: "The Most Common Checkmate", reason: "The mate that happens most often" },
          { id: "-gkzUKTO1W4", title: "Back-Rank Mate Explained", reason: "Why a king boxed in by pawns falls" },
          { id: "qZKlHQ3qzgM", title: "Essential checkmate! Back Rank mate", reason: "Spot it, and stop it on your side" },
        ],
      },
      {
        title: "Opening traps",
        summary: "Traps to spring, and to dodge",
        keywords: ["trap", "traps", "trappole", "trappola"],
        videos: [
          { id: "XnD6LlDPeAw", title: "A Mind-blowing Trap", reason: "An opening trap to know (and avoid)" },
          { id: "sozQmM1x5xU", title: "Top Secret Chess Opening Trap!", reason: "A sneaky trap from the opening" },
          { id: "feSldJjPRjY", title: "English Opening Trap", reason: "A trap from the English Opening" },
          { id: "V2C2P2jzKeM", title: "Nimzo-Larsen Trap: Chess Opening Tricks to Win Fast", reason: "A trap seen in a grandmaster game" },
        ],
      },
    ],
  },
  {
    label: "Skiing",
    emoji: "⛷️",
    lang: "en",
    match: ["ski", "skiing", "skier", "sciare", "carving", "carve", "esqui", "skifahren"],
    steps: [
      {
        title: "How carving works",
        summary: "What the ski does when it carves the snow",
        keywords: ["carve", "carving", "edges"],
        videos: [
          { id: "LrmCNarCzIY", title: "How to Carve on Skis", reason: "How a ski actually carves the snow" },
          { id: "2WKfNm_lflk", title: "How to Carve", reason: "Carving tips from an Olympic racer" },
        ],
      },
      {
        title: "Smoother carves",
        summary: "Cleaner turns with drills you can do today",
        keywords: ["smooth", "drills", "advanced"],
        videos: [
          { id: "nh0YYFXsiUw", title: "How to Carve on Skis Smoothly", reason: "Smoother, cleaner carved turns" },
          { id: "ihs5gT-WM6Q", title: "Advanced Carving Tips", reason: "Three drills to level up your carving" },
        ],
      },
      {
        title: "Steeper runs",
        summary: "Keep control when the slope gets steep",
        keywords: ["steep", "black", "ripido"],
        videos: [{ id: "dZVKJZ0fsvo", title: "How to carve on steep runs? 👇", reason: "Bend the ski for a tighter arc" }],
      },
    ],
  },
  {
    label: "Knife skills",
    emoji: "🔪",
    lang: "en",
    match: ["cooking", "cook", "cucina", "cucinare", "knife", "knives", "coltello", "chef", "kitchen", "cocina"],
    steps: [
      {
        title: "Hold the knife right",
        summary: "Grip, guiding hand and a safe stance",
        keywords: ["grip", "hold", "impugnatura"],
        videos: [{ id: "SkvdstYH15k", title: "Knife Skills - How To Use A Chef Knife", reason: "How to hold and use a chef's knife" }],
      },
      {
        title: "The essential cuts",
        summary: "Dice, slice, julienne and mince",
        keywords: ["dice", "julienne", "mince", "slice", "cuts", "tagli"],
        videos: [
          { id: "YrHpeEwk_-U", title: "9 Essential Knife Skills To Master", reason: "The cuts every cook uses" },
          { id: "Obe8idEt9qA", title: "The 10 Knife Skills Every Chef Needs to Learn", reason: "Ten techniques from pro kitchens" },
        ],
      },
      {
        title: "Faster and safer",
        summary: "Speed up without risking your fingers",
        keywords: ["fast", "faster", "speed", "veloce"],
        videos: [{ id: "QlCBG3_M060", title: "Basic Knife Skills: How to Chop 3x Faster", reason: "Chop faster, and more safely" }],
      },
    ],
  },
  {
    label: "Italian politics",
    emoji: "🏛️",
    lang: "it",
    match: ["politics", "political", "politica", "parlamento", "parliament", "governo", "costituzione", "constitution", "partiti", "elezioni", "senato"],
    steps: [
      {
        title: "How the state works",
        summary: "Parliament, Government, President and courts",
        keywords: ["state", "stato", "government", "governo", "president", "presidente"],
        videos: [
          { id: "1FqIsEFT4DQ", title: "Come funziona il sistema politico italiano?", reason: "Italy's political system in seconds" },
          { id: "r8pouZD6Wog", title: "Come funziona lo Stato?", reason: "Parliament, Government, President, courts" },
          { id: "pd6nwpsGsBA", title: "La politica italiana spiegata in due minuti", reason: "Who does what, in two minutes" },
        ],
      },
      {
        title: "Parliament and laws",
        summary: "Two chambers, and how a law is born",
        keywords: ["parliament", "parlamento", "laws", "leggi", "senato", "camera"],
        videos: [
          { id: "HcuuWpzSmTE", title: "Parlamento in breve", reason: "Two chambers and how laws pass" },
          { id: "Ww-rX3pV_AM", title: "Il Parlamento", reason: "How a law is born" },
        ],
      },
      {
        title: "The parties",
        summary: "The main parties and their leaders",
        keywords: ["parties", "partiti", "leaders"],
        videos: [{ id: "3UFqqsgMxK8", title: "I partiti italiani spiegati facile", reason: "The main parties and their leaders" }],
      },
      {
        title: "The Constitution",
        summary: "The founding principles, one article at a time",
        keywords: ["constitution", "costituzione", "articles", "articoli"],
        videos: [
          { id: "CDvPHbf6Sok", title: "Articolo 9 Costituzione italiana: spiegazione e commento", reason: "Culture and landscape in the Constitution" },
          { id: "EQyEFGiEuC4", title: "L'articolo 10 della Costituzione italiana", reason: "Foreigners' rights in the Constitution" },
          { id: "vjqjFaDZ-1g", title: "L'articolo 11 della Costituzione italiana", reason: "Why Italy rejects war" },
          { id: "xSr0mQl7Qfw", title: "L'articolo 12 della Costituzione Italiana 🇮🇹 #lacostituzioneinshorts", reason: "The flag, in article 12" },
        ],
      },
    ],
  },
  {
    label: "History",
    emoji: "📜",
    lang: "it",
    match: ["history", "storia", "historia", "histoire", "geschichte", "roma", "rome", "roman", "romani"],
    steps: [
      {
        title: "The big picture",
        summary: "From the Earth's origins to ancient Rome",
        keywords: ["earth", "terra", "rome", "roma", "ancient"],
        videos: [
          { id: "c8fMTcY1Q6U", title: "La storia del pianeta Terra in 1 minuto", reason: "4.5 billion years in a minute" },
          { id: "Mth2BL9VfPY", title: "La storia romana in un minuto!", reason: "Ancient Rome, from founding to fall" },
        ],
      },
      {
        title: "Italy takes shape",
        summary: "Its literature and its unification",
        keywords: ["unification", "unita", "risorgimento", "literature", "letteratura", "dante"],
        videos: [
          { id: "lF34xA5awR0", title: "La storia della letteratura italiana: autori, opere e influenza", reason: "Dante, Petrarch, Boccaccio, Machiavelli" },
          { id: "fGgMMiCI8Fc", title: "L'unità d'Italia (video lezione di storia)", reason: "How Italy became one country" },
        ],
      },
      {
        title: "Recent history",
        summary: "How artificial intelligence came to be",
        keywords: ["ai", "artificial intelligence", "intelligenza artificiale", "turing"],
        videos: [{ id: "L0XdvKk65Bw", title: "Storia dell'intelligenza artificiale", reason: "From the Turing test to today" }],
      },
    ],
  },
  {
    label: "Personal finance",
    emoji: "💶",
    lang: "it",
    match: ["finance", "finanza", "money", "soldi", "saving", "risparmio", "investing", "investire", "investimenti", "economia", "bonds", "obbligazioni"],
    steps: [
      {
        title: "Why money skills matter",
        summary: "The habits that pay off for life",
        keywords: ["budget", "saving", "risparmio", "habits"],
        videos: [
          { id: "9DG1sKYK8iU", title: "Educazione finanziaria in 4 minuti - Episodio 1", reason: "Why understanding money pays off" },
          { id: "12LMJlc7SXw", title: "Educazione finanziaria per ragazzi: 10 consigli pratici", reason: "Ten practical money tips" },
        ],
      },
      {
        title: "The basics of finance",
        summary: "Loans, investments and how they connect",
        keywords: ["loans", "finanziamenti", "basics"],
        videos: [{ id: "za3kQOADqWI", title: "La finanza: finanziamenti e investimenti (Schooltoon)", reason: "The basics, as a cartoon" }],
      },
      {
        title: "Start investing",
        summary: "Where to begin, starting with bonds",
        keywords: ["invest", "investing", "investire", "bonds", "obbligazioni", "etf"],
        videos: [
          { id: "Yq2sHi-Z21U", title: "Come investire? Introduzione al corso", reason: "Where to start with investing" },
          { id: "6kGt0rdASnM", title: "Come investire? Obbligazioni 1", reason: "What bonds are" },
        ],
      },
    ],
  },
  {
    label: "Physics",
    emoji: "🔭",
    lang: "it",
    match: ["physics", "fisica", "science", "scienza", "relativity", "relativita", "quantum", "quantistica", "universe", "universo"],
    steps: [
      {
        title: "Stories of discovery",
        summary: "How big ideas in science were found",
        keywords: ["history", "discoveries", "scoperte"],
        videos: [{ id: "evinJvJDiUM", title: "Storie di scienza - Eureka!", reason: "Discoveries and the people behind them" }],
      },
      {
        title: "Relativity",
        summary: "Why time stretches when you move fast",
        keywords: ["relativity", "relativita", "einstein"],
        videos: [{ id: "jikUCbpGs6o", title: "La teoria della relatività (spiegata in modo semplice!)", reason: "Why time stretches" }],
      },
      {
        title: "Quantum physics",
        summary: "The strange rules of the very small",
        keywords: ["quantum", "quantistica", "quanti"],
        videos: [{ id: "xtxyBr6Xhoo", title: "La fisica quantistica spiegata semplice", reason: "The quantum world, no formulas" }],
      },
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

function toVideo(v: SeedVideo): Video {
  return { id: v.id, title: v.title, channel: "", thumbnail: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, reason: v.reason };
}

export function seedSteps(seed: SeedTopic): PlanStep[] {
  return seed.steps.map((s) => ({
    title: s.title,
    summary: s.summary,
    queries: [],
    keywords: s.keywords,
    videos: s.videos.map(toVideo),
  }));
}
