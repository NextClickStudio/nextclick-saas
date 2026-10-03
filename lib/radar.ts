// Radar "chi ti sta cercando": cerca con Google post e contenuti pubblici recenti in cui aziende del tuo target
// esprimono un bisogno legato a quello che vendi (richieste, annunci di lavoro, lanci, discussioni).
// Ogni link viene verificato contro le fonti reali restituite da Google: niente post inventati.
import "server-only";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { UserError } from "@/lib/db";

export type RadarProfile = {
  /** settori / tipi di aziende target (es. "e-commerce beauty", "brand skincare") */
  sectors: string[];
  /** argomenti, problemi e parole chiave su cui intercettare conversazioni */
  topics: string[];
  /** ruoli delle persone che decidono (es. founder, marketing manager) */
  roles: string[];
  /** piattaforme preferite */
  platforms: string[];
  country: string;
};

export const RADAR_PLATFORMS = [
  { value: "linkedin", label: "LinkedIn", site: "linkedin.com" },
  { value: "instagram", label: "Instagram", site: "instagram.com" },
  { value: "facebook", label: "Gruppi Facebook", site: "facebook.com" },
  { value: "reddit", label: "Reddit e forum", site: "reddit.com" },
  { value: "lavoro", label: "Annunci di lavoro", site: "indeed / infojobs / linkedin jobs" },
  { value: "news", label: "News e lanci", site: "giornali e blog di settore" },
] as const;

export type RadarFinding = {
  url: string;
  platform: string;
  signal: string;
  author: string;
  company: string;
  date: string;
  excerpt: string;
  why: string;
  intent: number;
};

const findingSchema = z.object({
  items: z
    .array(
      z.object({
        url: z.string().trim().min(8).max(600),
        platform: z.string().trim().max(40).optional().default(""),
        signal: z.string().trim().max(40).optional().default(""),
        author: z.string().trim().max(160).optional().default(""),
        company: z.string().trim().max(160).optional().default(""),
        date: z.string().trim().max(60).optional().default(""),
        excerpt: z.string().trim().max(1200).optional().default(""),
        why: z.string().trim().max(600).optional().default(""),
        intent: z.coerce.number().min(1).max(3).optional().default(2),
      }),
    )
    .max(15),
});

/** URL confrontabili: senza protocollo, www, query, hash e slash finale. */
export function normalizeUrl(u: string): string {
  try {
    const x = new URL(u);
    return (x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "")).toLowerCase();
  } catch {
    return "";
  }
}

/** Le fonti di Google arrivano come link di reindirizzamento: ricaviamo l'indirizzo reale senza scaricare la pagina. */
async function resolveSource(uri: string): Promise<string | null> {
  if (!/vertexaisearch|grounding-api-redirect/.test(uri)) return uri;
  try {
    const res = await fetch(uri, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(6000) });
    await res.body?.cancel();
    return res.headers.get("location");
  } catch {
    return null;
  }
}

const SOCIAL: Record<string, string> = { linkedin: "post LinkedIn", instagram: "post Instagram", facebook: "gruppi Facebook", reddit: "Reddit e forum" };
function socialSources(p: RadarProfile): string {
  const chosen = p.platforms.filter((x) => SOCIAL[x]).map((x) => SOCIAL[x]);
  return (chosen.length ? chosen : Object.values(SOCIAL)).join(", ");
}

export const RADAR_SIGNALS = [
  {
    signal: "richiesta",
    ask: (p: RadarProfile, topics: string) =>
      `post o discussioni pubbliche (${socialSources(p)}) in cui aziende o professionisti di ${p.sectors.join(", ")} chiedono consigli, fornitori, tool o agenzie, o lamentano problemi su: ${topics}`,
  },
  {
    signal: "lavoro",
    ask: (p: RadarProfile, topics: string) =>
      `annunci di lavoro (LinkedIn Jobs, Indeed, InfoJobs, siti aziendali) di aziende di ${p.sectors.join(", ")} che cercano figure che si occuperebbero di: ${topics}`,
  },
  {
    signal: "lancio",
    ask: (p: RadarProfile) =>
      `notizie e post su aziende di ${p.sectors.join(", ")} che hanno appena lanciato un brand, uno shop online, una nuova linea, ricevuto un finanziamento o fatto un rebranding`,
  },
];

/** Una ricerca Google mirata (breve, così resta veloce). */
async function searchSignal(
  ai: GoogleGenAI,
  what: string,
  signal: string,
  p: RadarProfile,
  offer: string,
  debug?: (info: Record<string, unknown>) => void,
): Promise<RadarFinding[]> {
  const prompt = `Cerca ${what}.
Chi cerca vende: "${offer}". Il campo why deve spiegare perché QUESTA offerta è utile a loro, in concreto. Paese: ${p.country || "Italia"}. Solo contenuti degli ultimi 30 giorni.
Per ogni risultato trovato nella ricerca (massimo 5, i più recenti prima) dai: url (copia il link del risultato di ricerca), platform, author, company,
date, excerpt (cosa dice, 1-2 frasi fedeli), why (perché è un'occasione commerciale, 1 frase), intent (3 = cerca proprio questo, 2 = bisogno chiaro, 1 = debole).
Mai inventare. Rispondi SOLO con JSON {"items":[...]} (vuoto se non trovi nulla).`;
  const t0 = Date.now();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.2,
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        httpOptions: { timeout: 40_000 },
      },
    });
    const raw = response.text ?? "";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const resolved = (await Promise.all(chunks.map((c) => (c.web?.uri ? resolveSource(c.web.uri) : null)))).filter(
      (u): u is string => Boolean(u),
    );
    const sources = new Set(resolved.map(normalizeUrl));
    debug?.({ signal, s: (Date.now() - t0) / 1000, chunks: chunks.length, resolved, raw: raw.slice(0, 1500) });
    const parsed = findingSchema.safeParse(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1) || "{}"));
    if (!parsed.success) return [];
    // solo link verificati: o sono un link di Google che si risolve in un indirizzo reale, o compaiono tra le fonti
    const checked = await Promise.all(
      parsed.data.items.map(async (i) => {
        if (/vertexaisearch|grounding-api-redirect/.test(i.url)) {
          const real = await resolveSource(i.url);
          return real && /^https?:\/\//.test(real) ? { ...i, url: real } : null;
        }
        return sources.has(normalizeUrl(i.url)) ? i : null;
      }),
    );
    return checked
      .filter((i): i is NonNullable<typeof i> => i !== null)
      .map((i) => ({ ...i, signal: i.signal || signal, intent: Math.round(i.intent) }));
  } catch (err) {
    debug?.({ signal, s: (Date.now() - t0) / 1000, error: String((err as Error).message).slice(0, 200), status: (err as { status?: number }).status });
    return [];
  }
}

export async function scanRadar(
  input: { profile: RadarProfile; offer: string; exclude: string[] },
  debug?: (info: Record<string, unknown>) => void,
): Promise<RadarFinding[]> {
  if (!process.env.GEMINI_API_KEY) throw new UserError("Ricerca non disponibile: manca la chiave Gemini.");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const p = input.profile;
  const topics = p.topics.join(", ") || input.offer;
  const wanted = RADAR_SIGNALS.filter((x) => signalEnabled(x.signal, p));
  const results = (await Promise.all(wanted.map((x) => searchSignal(ai, x.ask(p, topics), x.signal, p, input.offer, debug)))).flat();
  const excluded = new Set(input.exclude.map(normalizeUrl));
  const seen = new Set<string>();
  return results
    .filter((i) => {
      const n = normalizeUrl(i.url);
      if (!n || excluded.has(n) || seen.has(n)) return false;
      seen.add(n);
      return true;
    })
    .sort((a, b) => b.intent - a.intent);
}

/** Con piattaforme scelte: annunci solo se "lavoro", lanci solo se "news". Nessuna scelta = tutto. */
export function signalEnabled(signal: string, p: RadarProfile): boolean {
  if (p.platforms.length === 0) return true;
  if (signal === "lavoro") return p.platforms.includes("lavoro");
  if (signal === "lancio") return p.platforms.includes("news");
  return p.platforms.some((x) => SOCIAL[x]);
}

export type RadarSignal = (typeof RADAR_SIGNALS)[number]["signal"];

/** Una sola ricerca (un tipo di segnale): così ogni chiamata resta sotto il minuto. */
export async function searchRadarSignal(signal: RadarSignal, profile: RadarProfile, offer: string): Promise<RadarFinding[]> {
  if (!process.env.GEMINI_API_KEY) throw new UserError("Ricerca non disponibile: manca la chiave Gemini.");
  const def = RADAR_SIGNALS.find((x) => x.signal === signal)!;
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const topics = profile.topics.join(", ") || offer;
  return (await searchSignal(ai, def.ask(profile, topics), signal, profile, offer)).sort((a, b) => b.intent - a.intent);
}

/** Profilo letto dal database, con valori sicuri. */
export function readProfile(raw: unknown): RadarProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<RadarProfile>;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").slice(0, 12) : []);
  const profile = { sectors: list(r.sectors), topics: list(r.topics), roles: list(r.roles), platforms: list(r.platforms), country: typeof r.country === "string" ? r.country : "Italia" };
  return profile.sectors.length > 0 ? profile : null;
}
