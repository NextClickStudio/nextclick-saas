// Radar "chi ti sta cercando": cerca con Google post e contenuti pubblici recenti in cui aziende del tuo target
// esprimono un bisogno legato a quello che vendi (richieste, annunci di lavoro, lanci, discussioni).
// Ogni link viene verificato contro le fonti reali restituite da Google: niente post inventati.
import "server-only";
import { GoogleGenAI } from "@google/genai";
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

export async function scanRadar(
  input: { profile: RadarProfile; offer: string; exclude: string[] },
  debug?: (info: Record<string, unknown>) => void,
): Promise<RadarFinding[]> {
  if (!process.env.GEMINI_API_KEY) throw new UserError("Ricerca non disponibile: manca la chiave Gemini.");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const p = input.profile;
  const platforms = RADAR_PLATFORMS.filter((x) => p.platforms.length === 0 || p.platforms.includes(x.value));
  const prompt = `Sei il commerciale di chi vende: "${input.offer}".
Cerca sul web contenuti PUBBLICATI NEGLI ULTIMI 30 GIORNI (${p.country || "Italia"}) in cui aziende o persone di questi settori:
${p.sectors.join(", ") || "il target di chi vende"}
mostrano un bisogno legato a: ${p.topics.join(", ") || input.offer}.
Ruoli che ci interessano: ${p.roles.join(", ") || "founder, titolari, marketing, e-commerce"}.

Cerca questi segnali, su queste fonti: ${platforms.map((x) => `${x.label} (${x.site})`).join("; ")}.
- richiesta: chiedono consigli, fornitori, tool o agenzie ("cerchiamo", "consigliatemi", "qualcuno conosce")
- lavoro: annunci di lavoro per ruoli che risolverebbero quel problema (hanno budget e un buco da coprire)
- lancio: nuovo brand, nuovo shop online, nuova collezione, finanziamento, rebranding
- discussione: post in cui lamentano il problema o ne parlano

Per ogni risultato TROVATO NELLA RICERCA (massimo 10, i più recenti e caldi prima):
url (indirizzo esatto del post/annuncio/articolo, copiato dal risultato), platform, signal (richiesta|lavoro|lancio|discussione),
author (chi ha scritto, se visibile), company (azienda), date (data o "x giorni fa"), excerpt (cosa dice, 1-3 frasi fedeli),
why (perché è un'occasione per chi vende, 1 frase), intent (3 = cerca proprio questo, 2 = bisogno chiaro, 1 = segnale debole).
Mai inventare post o link. Se non trovi nulla: {"items":[]}.
Rispondi SOLO con JSON: {"items":[{...}]}`;

  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: { temperature: 0.2, tools: [{ googleSearch: {} }], httpOptions: { timeout: 50_000 } },
    });
  } catch (err) {
    const status = (err as { status?: number }).status;
    debug?.({ error: String((err as Error).message).slice(0, 300), status });
    if (status === 429) throw new UserError("Limite di ricerche raggiunto: riprova tra qualche minuto.");
    throw new UserError("Il Radar non è riuscito a cercare ora. Riprova tra poco.");
  }

  const raw = response.text ?? "";
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const resolved = (await Promise.all(chunks.map((c) => (c.web?.uri ? resolveSource(c.web.uri) : null)))).filter(
    (u): u is string => Boolean(u),
  );
  const sources = new Set(resolved.map(normalizeUrl));
  debug?.({ chunks: chunks.length, resolved, raw: raw.slice(0, 2500) });

  let parsed;
  try {
    parsed = findingSchema.safeParse(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1) || "{}"));
  } catch {
    return [];
  }
  if (!parsed.success) return [];
  const excluded = new Set(input.exclude.map(normalizeUrl));
  const seen = new Set<string>();
  return parsed.data.items
    .filter((i) => {
      const n = normalizeUrl(i.url);
      // solo link che compaiono davvero tra le fonti di Google
      if (!n || !sources.has(n) || excluded.has(n) || seen.has(n)) return false;
      seen.add(n);
      return true;
    })
    .map((i) => ({ ...i, intent: Math.round(i.intent) }));
}
