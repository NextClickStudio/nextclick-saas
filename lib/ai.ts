// Chiamate all'AI: schemi di output, prompt (in italiano) e validazione.
//
// Due modi per usare l'AI (si sceglie da solo):
// 1. Vercel AI Gateway (predefinito): su Vercel funziona senza chiavi, grazie al token
//    OIDC del progetto, e usa i crediti gratuiti mensili di Vercel.
//    In locale serve AI_GATEWAY_API_KEY (Vercel → AI Gateway → API Keys).
// 2. Google Gemini diretto: solo se imposti GEMINI_API_KEY.
import "server-only";
import { GoogleGenAI } from "@google/genai";
import { getVercelOidcToken } from "@vercel/oidc";
import { z } from "zod";
import { UserError } from "@/lib/db";

// Nome del modello in un punto solo: per cambiarlo modifica solo queste righe.
// Modelli Gemini provati in ordine (con GEMINI_API_KEY): se uno è sovraccarico o ha finito
// la quota gratuita del giorno, si passa al successivo. Si può forzarne uno con GEMINI_MODEL.
export const GEMINI_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-flash-lite-latest", "gemini-3.5-flash-lite"];
export const GATEWAY_MODEL = process.env.AI_MODEL || "google/gemini-2.5-flash"; // usato con AI Gateway
// modello con ricerca web, per trovare le aziende (via AI Gateway)
export const DISCOVERY_MODEL = process.env.DISCOVERY_MODEL || "perplexity/sonar-pro";
const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";

let gemini: GoogleGenAI | null = null;

/** Una chiamata al modello che restituisce il testo JSON grezzo. */
async function callModel(prompt: string, schema: object, temperature: number, model = GATEWAY_MODEL): Promise<string> {
  // con GEMINI_API_KEY si usa Gemini diretto per tutto (anche per trovare le aziende)
  if (process.env.GEMINI_API_KEY) return callGemini(prompt, schema, temperature);

  let token = process.env.AI_GATEWAY_API_KEY;
  if (!token) {
    try {
      token = await getVercelOidcToken();
    } catch {
      throw new UserError(
        "Configurazione mancante: su Vercel l'AI funziona da sola; in locale imposta AI_GATEWAY_API_KEY (o GEMINI_API_KEY).",
      );
    }
  }
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_schema", json_schema: { name: "risposta", schema } },
    }),
  });
  if (res.status === 403) {
    throw new UserError(
      "L'AI non è ancora attiva: su Vercel → AI Gateway aggiungi una carta di credito per sbloccare i crediti gratuiti.",
    );
  }
  if (res.status === 402 || res.status === 429) {
    throw new UserError("Crediti AI esauriti o troppe richieste: riprova più tardi o aggiungi crediti su Vercel → AI Gateway.");
  }
  if (!res.ok) throw new Error(`AI Gateway ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

/** Gemini diretto, provando più modelli se uno è sovraccarico o senza quota. */
async function callGemini(prompt: string, schema: object, temperature: number): Promise<string> {
  gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  let quotaExceeded = false;
  for (const model of GEMINI_MODELS) {
    try {
      const response = await gemini.models.generateContent({
        model,
        contents: prompt,
        config: { temperature, responseMimeType: "application/json", responseJsonSchema: schema },
      });
      return response.text ?? "";
    } catch (err) {
      const status = (err as { status?: number }).status;
      const message = err instanceof Error ? err.message : "";
      console.error(`Gemini ${model}: ${status ?? ""} ${message.slice(0, 200)}`);
      if (status === 400 && /api key|API_KEY/i.test(message)) {
        throw new UserError("La chiave Gemini non è valida: controlla GEMINI_API_KEY.");
      }
      if (status === 429) quotaExceeded = true;
      // 429 (quota), 503 (sovraccarico), 404 (modello non disponibile), 500: si prova il modello successivo
    }
  }
  throw new UserError(
    quotaExceeded
      ? "Hai raggiunto il limite gratuito di Gemini per ora: riprova tra qualche minuto (o domani, se è il limite giornaliero)."
      : "L'AI di Google è molto richiesta in questo momento. Riprova tra qualche minuto.",
  );
}

/**
 * Chiede al modello JSON con uno schema preciso, poi valida con zod.
 * Se la risposta non è valida riprova una volta; poi restituisce un errore leggibile.
 */
async function generateJson<T>(opts: {
  prompt: string;
  schema: object;
  validator: z.ZodType<T>;
  temperature: number;
  model?: string;
}): Promise<T> {
  let lastProblem = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await callModel(opts.prompt, opts.schema, opts.temperature, opts.model);
      // alcuni modelli aggiungono testo o ``` attorno al JSON: tieni solo l'oggetto
      const text = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
      const parsed = opts.validator.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
      lastProblem = "risposta AI non valida";
      console.error("AI: JSON non valido", parsed.error.issues.slice(0, 5));
    } catch (err) {
      if (err instanceof UserError) throw err;
      lastProblem = "errore di comunicazione con l'AI";
      console.error("AI: errore", err);
    }
  }
  throw new UserError(`L'AI non ha restituito una risposta utilizzabile (${lastProblem}). Riprova tra qualche istante.`);
}

// ---------------------------------------------------------------------
// A) Sintomo visibile + criteri
// ---------------------------------------------------------------------

export const generatedCriterionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(600),
  how_to_check: z.string().trim().min(1).max(600),
  weight: z.coerce.number().int().min(1).max(5),
});

const symptomResultSchema = z.object({
  symptom: z.string().trim().min(1).max(1000),
  index_name: z.string().trim().min(1).max(120),
  criteria: z.array(generatedCriterionSchema).min(6).max(10),
});
export type SymptomResult = z.infer<typeof symptomResultSchema>;

// Schema JSON standard dell'output (lo capiscono sia Gemini sia AI Gateway).
const symptomJsonSchema = {
  type: "object",
  properties: {
    symptom: { type: "string", description: "Il sintomo visibile, in 1-3 frasi" },
    index_name: {
      type: "string",
      description: 'Nome breve per una classifica pubblica di settore, es. "Indice della consulenza online"',
    },
    criteria: {
      type: "array",
      minItems: 6,
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          how_to_check: { type: "string" },
          weight: { type: "integer", description: "Importanza da 1 a 5" },
        },
        required: ["name", "description", "how_to_check", "weight"],
        additionalProperties: false,
      },
    },
  },
  required: ["symptom", "index_name", "criteria"],
  additionalProperties: false,
};

export async function generateSymptomAndCriteria(input: {
  productDescription: string;
  targetCustomer: string;
  targetSector: string;
}): Promise<SymptomResult> {
  const prompt = `Sei un esperto di strategia commerciale B2B.

L'utente vende questo prodotto:
"""${input.productDescription}"""

Lo vende a:
"""${input.targetCustomer}"""

Settore delle aziende target:
"""${input.targetSector}"""

COMPITO
1. Individua il "sintomo visibile": il segnale più forte, osservabile SOLO guardando dall'esterno il sito web di un'azienda target, che indica che quell'azienda ha il problema risolto dal prodotto. Descrivilo in 1-3 frasi chiare.
2. Proponi un nome breve per una classifica pubblica del settore basata su questo sintomo, formulato in positivo (es. "Indice della consulenza online"). Non citare il prodotto dell'utente.
3. Scrivi da 6 a 10 criteri per misurare quel sintomo leggendo il testo e la struttura di massimo 3 pagine del sito (homepage, una pagina prodotto, una pagina categoria).

Ogni criterio deve essere:
- verificabile dal testo estratto da una pagina web (titoli, testi, pulsanti, link, presenza di form, quiz, chat, filtri, recensioni). Non servono dati interni, analytics o login;
- specifico per questo settore e questo sintomo, non generico (evita cose come "il sito è bello");
- formulato in modo che un punteggio ALTO significhi "l'azienda è già brava, il sintomo è assente".

Per ogni criterio indica: name (breve), description (cosa misura), how_to_check (cosa cercare concretamente nel testo della pagina), weight (1-5, quanto pesa sul sintomo).
Scrivi tutto in italiano.`;

  return generateJson({ prompt, schema: symptomJsonSchema, validator: symptomResultSchema, temperature: 0.6 });
}

// ---------------------------------------------------------------------
// B) Valutazione di un sito
// ---------------------------------------------------------------------

const evaluationSchema = z.object({
  scores: z.array(
    z.object({
      criterion_id: z.string(),
      score: z.coerce.number().min(0).max(10),
      evidence: z.string().trim().min(1).max(1000),
    }),
  ),
  weak_points: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        explanation: z.string().trim().min(1).max(1200),
        evidence: z.string().trim().min(1).max(800),
      }),
    )
    .min(1)
    .max(5),
  summary: z.string().trim().min(1).max(800),
  contact_plan: z.object({
    channel_type: z.string().trim().min(1).max(40),
    channel_label: z.string().trim().min(1).max(200),
    why: z.string().trim().min(1).max(800),
    steps: z.array(z.string().trim().min(1).max(500)).min(2).max(5),
    opening_angle: z.string().trim().min(1).max(600),
  }),
});
export type Evaluation = z.infer<typeof evaluationSchema>;

const evaluationJsonSchema = {
  type: "object",
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        properties: {
          criterion_id: { type: "string" },
          score: { type: "integer", description: "Da 0 a 10" },
          evidence: { type: "string" },
        },
        required: ["criterion_id", "score", "evidence"],
        additionalProperties: false,
      },
    },
    weak_points: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          explanation: { type: "string" },
          evidence: { type: "string" },
        },
        required: ["title", "explanation", "evidence"],
        additionalProperties: false,
      },
    },
    summary: { type: "string" },
    contact_plan: {
      type: "object",
      properties: {
        channel_type: { type: "string" },
        channel_label: { type: "string" },
        why: { type: "string" },
        steps: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
        opening_angle: { type: "string" },
      },
      required: ["channel_type", "channel_label", "why", "steps", "opening_angle"],
      additionalProperties: false,
    },
  },
  required: ["scores", "weak_points", "summary", "contact_plan"],
  additionalProperties: false,
};

export async function evaluateWebsite(input: {
  companyName: string;
  productDescription: string;
  targetCustomer: string;
  symptom: string;
  channels: { type: string; label: string; url?: string }[];
  criteria: { id: string; name: string; description: string; how_to_check: string }[];
  pages: { url: string; content: string }[];
}): Promise<Evaluation> {
  const criteriaText = input.criteria
    .map((c) => `- id: ${c.id}\n  nome: ${c.name}\n  cosa misura: ${c.description}\n  come verificarlo: ${c.how_to_check}`)
    .join("\n");
  const pagesText = input.pages
    .map((p, i) => `=== PAGINA ${i + 1}: ${p.url} ===\n${p.content}`)
    .join("\n\n");

  const prompt = `Valuti il sito web di un'azienda sui criteri indicati.

Contesto (NON va mai citato nella risposta): chi ti chiede l'analisi vende "${input.productDescription}".
Sintomo che stiamo misurando: ${input.symptom}

CRITERI
${criteriaText}

TESTO ESTRATTO DAL SITO
${pagesText}

CANALI DI CONTATTO PUBBLICATI DALL'AZIENDA "${input.companyName}" SUL SITO
${input.channels.length ? input.channels.map((c) => `- ${c.type}: ${c.label}${c.url ? ` (${c.url})` : ""}`).join("\n") : "- nessun canale trovato oltre al sito"}

ISTRUZIONI
- Per OGNI criterio (usa esattamente il suo id) assegna un punteggio intero da 0 a 10 (10 = eccellente, sintomo assente) e una prova concreta: cosa hai visto o NON hai visto nel testo, citando brevemente la pagina (es. "In homepage...", "Nella pagina prodotto...").
- Non inventare: se l'informazione non è nel testo, dillo e assegna un punteggio prudente.
- Poi identifica i 3 punti in cui questo sito perde più clienti. Spiegali in modo concreto e rispettoso, come li leggerebbe il titolare dell'azienda: titolo breve, spiegazione (2-3 frasi) e prova.
- Non nominare mai il prodotto di chi chiede l'analisi e non fare pubblicità: descrivi solo il problema.
- Scrivi un riassunto di 2 frasi.
- Non riportare email, numeri di telefono o nomi di persone.
Scrivi tutto in italiano, dando del "tu" al titolare.

PIANO DI CONTATTO (privato: lo legge solo chi vende, NON l'azienda analizzata)
Chi vende "${input.productDescription}" a "${input.targetCustomer}" vuole contattare questa azienda SENZA cold email.
- Scegli il canale più diretto e con più probabilità di arrivare al titolare o a chi decide, tra i canali elencati sopra
  (es. DM Instagram del brand, WhatsApp aziendale, chat del sito, pagina LinkedIn aziendale per individuare chi decide, modulo partner/B2B).
  Se non c'è nessun canale, proponi LinkedIn: cercare titolare o responsabile e-commerce dell'azienda.
- channel_type: il tipo del canale scelto (usa uno dei tipi elencati, oppure "linkedin"). channel_label: nome leggibile del canale.
- why: perché questo canale funziona per questa azienda (1-2 frasi concrete).
- steps: 3-4 passi pratici e brevi. Il primo contatto deve essere un valore regalato, non una vendita: il report gratuito
  con la posizione in classifica e i 3 punti deboli. Niente link sospetti al primo messaggio se il canale lo sconsiglia.
- opening_angle: l'aggancio personalizzato da usare, basato sul punto debole più forte trovato (1-2 frasi, tono rispettoso).`;

  const ids = new Set(input.criteria.map((c) => c.id));
  // lo schema zod controlla anche che ci sia un punteggio per ogni criterio
  const validator = evaluationSchema.refine(
    (v) => ids.size > 0 && [...ids].every((id) => v.scores.some((s) => s.criterion_id === id)),
    { message: "punteggi mancanti per alcuni criteri" },
  );

  const result = await generateJson({ prompt, schema: evaluationJsonSchema, validator, temperature: 0.2 });
  // tieni solo i criteri conosciuti, una volta ciascuno, con punteggi interi
  const seen = new Set<string>();
  result.scores = result.scores
    .filter((s) => ids.has(s.criterion_id) && !seen.has(s.criterion_id) && seen.add(s.criterion_id))
    .map((s) => ({ ...s, score: Math.round(s.score) }));
  result.weak_points = result.weak_points.slice(0, 3);
  return result;
}

// ---------------------------------------------------------------------
// C) Ricerca automatica delle aziende (con ricerca web)
// ---------------------------------------------------------------------

const discoverySchema = z.object({
  companies: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        website: z.string().trim().min(4).max(300),
        size: z.string().trim().max(40).optional().default(""),
        reason: z.string().trim().max(500).optional().default(""),
      }),
    )
    .min(1),
});
export type DiscoveredCompany = z.infer<typeof discoverySchema>["companies"][number];

const discoveryJsonSchema = {
  type: "object",
  properties: {
    companies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          website: { type: "string", description: "URL della homepage, es. https://www.esempio.it" },
          size: { type: "string", description: "piccola, media o grande" },
          reason: { type: "string", description: "Perché è un buon prospect (1 frase)" },
        },
        required: ["name", "website", "size", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["companies"],
  additionalProperties: false,
};

const SIZE_TEXT: Record<string, string> = {
  piccole: "PICCOLE (indicativamente fino a 10 dipendenti o fatturato sotto 2 milioni €, brand emergenti o di nicchia)",
  medie: "MEDIE (indicativamente 10-250 dipendenti, brand affermati ma non leader nazionali)",
  grandi: "GRANDI (leader di mercato, oltre 250 dipendenti o brand molto noti)",
  tutte: "di qualunque dimensione (con un buon mix di piccole e medie)",
};

export async function discoverCompanies(input: {
  productDescription: string;
  targetCustomer: string;
  targetSector: string;
  targetSize: string;
  country: string;
  symptom: string;
  count: number;
  exclude: string[];
}): Promise<DiscoveredCompany[]> {
  const prompt = `Sei un ricercatore commerciale B2B. Individua aziende REALI e ATTIVE (cercale sul web se puoi, altrimenti usa le tue conoscenze) che siano ottimi potenziali clienti.

Chi vende offre: """${input.productDescription}"""
Cliente ideale: """${input.targetCustomer}"""
Settore: ${input.targetSector}
Area geografica: ${input.country}
Dimensione: ${SIZE_TEXT[input.targetSize] ?? SIZE_TEXT.tutte}
Segnale da cercare (il loro problema): ${input.symptom}

Trova ${input.count} aziende diverse, ciascuna con il proprio sito web ufficiale e funzionante (dominio dell'azienda, non marketplace,
non Amazon/Etsy/Facebook, non directory o articoli). Preferisci aziende che con buona probabilità hanno il problema descritto.
${input.exclude.length ? `NON includere queste aziende, già contattate in passato (proponine di NUOVE e diverse, anche meno famose): ${input.exclude.slice(0, 200).join(", ")}` : ""}

Per ogni azienda: name, website (homepage), size (piccola/media/grande, stima), reason (1 frase sul perché è un buon prospect).
Rispondi SOLO con il JSON richiesto.`;

  const ask = (model: string) =>
    generateJson({ prompt, schema: discoveryJsonSchema, validator: discoverySchema, temperature: 0.3, model });
  try {
    return (await ask(DISCOVERY_MODEL)).companies;
  } catch (err) {
    // se il modello con ricerca web non è disponibile, usa il modello normale:
    // i siti proposti vengono comunque verificati uno per uno prima di essere salvati
    if (process.env.GEMINI_API_KEY) throw err; // con Gemini diretto il modello è già lo stesso
    if (err instanceof UserError && err.message.startsWith("Crediti AI")) throw err;
    console.error("Ricerca web non riuscita, uso il modello standard", err);
    return (await ask(GATEWAY_MODEL)).companies;
  }
}

// ---------------------------------------------------------------------
// D) Messaggi personalizzati per canale (primo contatto e follow-up)
// ---------------------------------------------------------------------

export const OUTREACH_STEPS = ["Primo contatto", "Follow-up 1", "Follow-up 2"] as const;

const outreachSchema = z.object({
  messages: z
    .array(
      z.object({
        channel: z.string().trim().min(1).max(40),
        subject: z.string().trim().max(200).optional().default(""),
        body: z.string().trim().min(1).max(3000),
      }),
    )
    .min(1),
});
export type OutreachDraft = z.infer<typeof outreachSchema>["messages"][number];

const outreachJsonSchema = {
  type: "object",
  properties: {
    messages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          channel: { type: "string" },
          subject: { type: "string", description: "Solo per email, altrimenti stringa vuota" },
          body: { type: "string" },
        },
        required: ["channel", "subject", "body"],
        additionalProperties: false,
      },
    },
  },
  required: ["messages"],
  additionalProperties: false,
};

const CHANNEL_RULES: Record<string, string> = {
  instagram: "DM Instagram: massimo 450 caratteri, tono umano e diretto, niente formalità da email, al massimo 1 emoji.",
  whatsapp: "WhatsApp: massimo 400 caratteri, tono cordiale e diretto, presentati con nome e azienda nella prima riga.",
  facebook: "Messenger della pagina Facebook: massimo 450 caratteri, tono cordiale.",
  linkedin: "LinkedIn (nota di collegamento o messaggio alla persona che decide): massimo 280 caratteri.",
  sito: "Modulo contatti o chat del sito: massimo 600 caratteri, chiedi di inoltrare al titolare o al responsabile e-commerce.",
  email: "Email: oggetto breve e specifico (massimo 60 caratteri, niente clickbait) e corpo di massimo 120 parole, firma con nome e azienda.",
};

export async function generateOutreach(input: {
  companyName: string;
  sector: string;
  productDescription: string;
  senderName: string;
  senderCompany: string;
  senderRole: string;
  bookingUrl: string;
  reportUrl: string;
  position: number | null;
  total: number;
  score: number;
  weakPoints: { title: string; explanation: string }[];
  openingAngle: string;
  channels: string[];
  step: number;
  previous: string[];
}): Promise<OutreachDraft[]> {
  const stepText =
    input.step === 0
      ? `PRIMO CONTATTO. Obiettivo: far aprire il report gratuito. Regala valore: cita UN punto debole concreto in modo rispettoso,
spiega che hai preparato un'analisi gratuita del loro sito rispetto ad altre ${input.total} aziende del settore e metti il link.
Non vendere il prodotto, non chiedere una call nel primo messaggio.`
      : input.step === 1
        ? `FOLLOW-UP 1 (dopo qualche giorno senza risposta). Breve. Aggiungi UNA nuova osservazione utile (un altro punto debole),
ricorda il link al report e proponi, senza insistere, 15 minuti per parlarne${input.bookingUrl ? ` (link per prenotare: ${input.bookingUrl})` : ""}.`
        : `FOLLOW-UP 2 (ultimo messaggio). Brevissimo e cortese: chiudi il ciclo, lascia la porta aperta, nessuna pressione.`;

  const prompt = `Scrivi messaggi di contatto commerciale B2B in italiano, personalizzati per l'azienda "${input.companyName}" (settore: ${input.sector}).

Chi scrive: ${input.senderName || "il mittente"}${input.senderRole ? `, ${input.senderRole}` : ""}${input.senderCompany ? ` di ${input.senderCompany}` : ""}.
Cosa offre (NON va descritto come pubblicità, al massimo accennato nel follow-up): ${input.productDescription}

Dati dell'analisi del loro sito:
- posizione ${input.position ?? "?"} su ${input.total} aziende analizzate, punteggio ${input.score}/100
- punti deboli: ${input.weakPoints.map((w) => `${w.title} (${w.explanation})`).join(" | ")}
- aggancio suggerito: ${input.openingAngle}
- link al report privato: ${input.reportUrl}

${stepText}
${input.previous.length ? `Messaggi già inviati (non ripeterli):\n${input.previous.map((p) => `- ${p.slice(0, 300)}`).join("\n")}` : ""}

REGOLE
- Scrivi un messaggio per ciascuno di questi canali: ${input.channels.join(", ")}.
- ${input.channels.map((c) => CHANNEL_RULES[c] ?? c).join("\n- ")}
- Usa il nome dell'azienda. Sembra scritto a mano da una persona, non un template. Niente frasi fatte ("spero tu stia bene").
- Non dire mai che sai se hanno aperto il report. Non inventare dati che non sono qui sopra.
- Inserisci il link al report esattamente così: ${input.reportUrl}
- Il campo channel deve essere esattamente uno di: ${input.channels.join(", ")}.`;

  const result = await generateJson({ prompt, schema: outreachJsonSchema, validator: outreachSchema, temperature: 0.7 });
  return result.messages.filter((m) => input.channels.includes(m.channel));
}
