// Chiamate all'AI: schemi di output, prompt (in italiano) e validazione.
//
// Due modi per usare l'AI (si sceglie da solo):
// 1. Vercel AI Gateway (predefinito): su Vercel funziona senza chiavi, grazie al token
//    OIDC del progetto, e usa i crediti gratuiti mensili di Vercel.
//    In locale serve AI_GATEWAY_API_KEY (Vercel → AI Gateway → API Keys).
// 2. Google Gemini diretto: solo se imposti GEMINI_API_KEY.
import "server-only";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
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
        // massimo 40 secondi per modello: se uno è lento si passa al successivo
        config: { temperature, responseMimeType: "application/json", responseJsonSchema: schema, httpOptions: { timeout: 40_000 } },
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
    person_name: z.string().trim().max(120).optional().default(""),
    person_role: z.string().trim().max(120).optional().default(""),
  }),
  people: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(120),
        role: z.string().trim().min(2).max(120),
        instagram_url: z.string().trim().max(300).optional().default(""),
        linkedin_url: z.string().trim().max(300).optional().default(""),
        whatsapp_url: z.string().trim().max(300).optional().default(""),
      }),
    )
    .max(6)
    .optional()
    .default([]),
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
        person_name: { type: "string", description: "Persona a cui scrivere, se il canale è suo; altrimenti stringa vuota" },
        person_role: { type: "string" },
      },
      required: ["channel_type", "channel_label", "why", "steps", "opening_angle", "person_name", "person_role"],
      additionalProperties: false,
    },
    people: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          instagram_url: { type: "string", description: "Solo un URL presente nell'elenco PROFILI, altrimenti stringa vuota" },
          linkedin_url: { type: "string", description: "Solo un URL presente nell'elenco PROFILI, altrimenti stringa vuota" },
          whatsapp_url: { type: "string", description: "Solo un URL presente nell'elenco PROFILI, altrimenti stringa vuota" },
        },
        required: ["name", "role", "instagram_url", "linkedin_url", "whatsapp_url"],
        additionalProperties: false,
      },
    },
  },
  required: ["scores", "weak_points", "summary", "contact_plan", "people"],
  additionalProperties: false,
};

export async function evaluateWebsite(input: {
  companyName: string;
  productDescription: string;
  targetCustomer: string;
  symptom: string;
  channels: { type: string; label: string; url?: string }[];
  profiles?: { network: string; url: string; context: string }[];
  peopleHints?: string[];
  criteria: { id: string; name: string; description: string; how_to_check: string }[];
  pages: { url: string; content: string }[];
}): Promise<Evaluation> {
  const profiles = input.profiles ?? [];
  const hints = input.peopleHints ?? [];
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

FRASI CHE NOMINANO PERSONE CON UN RUOLO (dal sito: chi siamo, team, homepage; oppure trovate con Google)
${hints.length ? hints.map((h) => `- ${h}`).join("\n") : "- nessuna"}

PROFILI PERSONALI (linkati sul sito o trovati con Google, con il testo vicino)
${profiles.length ? profiles.map((p) => `- ${p.network}: ${p.url}${p.context ? ` — vicino a: "${p.context}"` : ""}`).join("\n") : "- nessuno"}

ISTRUZIONI
- Per OGNI criterio (usa esattamente il suo id) assegna un punteggio intero da 0 a 10 (10 = eccellente, sintomo assente) e una prova concreta: cosa hai visto o NON hai visto nel testo, citando brevemente la pagina (es. "In homepage...", "Nella pagina prodotto...").
- Non inventare: se l'informazione non è nel testo, dillo e assegna un punteggio prudente.
- Poi identifica i 3 punti in cui questo sito perde più clienti. Spiegali in modo concreto e rispettoso, come li leggerebbe il titolare dell'azienda: titolo breve, spiegazione (2-3 frasi) e prova.
- Non nominare mai il prodotto di chi chiede l'analisi e non fare pubblicità: descrivi solo il problema.
- Scrivi un riassunto di 2 frasi.
- In punteggi, punti deboli e riassunto (li legge l'azienda) non riportare email, numeri di telefono o nomi di persone.
Scrivi tutto in italiano, dando del "tu" al titolare.

PERSONE CHIAVE (privato: lo legge solo chi vende)
- people: fino a 4 persone che decidono, con nome e ruolo SCRITTI ESPLICITAMENTE nelle frasi o nel testo del sito qui sopra:
  founder/fondatore, titolare, CEO, socio, direttore, responsabile marketing, commerciale/vendite, e-commerce manager.
  Usa solo le persone delle FRASI qui sopra (dal sito o da Google). Mai inventare nomi o ruoli: se non ce ne sono, people è una lista vuota. Niente dipendenti generici (assistenza, magazzino).
- Associa a una persona un profilo dell'elenco PROFILI solo se il testo vicino al link o il nome del profilo corrisponde chiaramente
  a quella persona. Copia l'URL esattamente; se non sei sicuro lascia la stringa vuota.

PIANO DI CONTATTO (privato: lo legge solo chi vende, NON l'azienda analizzata)
Chi vende "${input.productDescription}" a "${input.targetCustomer}" vuole contattare questa azienda SENZA cold email.
- Scegli il canale che arriva più direttamente a chi decide, in questo ordine di preferenza (usa il primo disponibile salvo motivi forti):
  1) WhatsApp di una persona chiave  2) Instagram personale di una persona chiave  3) WhatsApp aziendale
  4) Instagram del brand  5) LinkedIn personale di una persona chiave  6) chat del sito, pagina partner/B2B, modulo contatti
  7) se non c'è nulla: LinkedIn, cercando il titolare o il responsabile marketing/e-commerce.
- channel_type: il tipo del canale scelto (whatsapp, instagram, linkedin, facebook, chat_live, pagina_partner, form_contatti, pagina_contatti).
  channel_label: nome leggibile (es. "Instagram di Giulia Bianchi, founder" oppure "WhatsApp aziendale").
- person_name e person_role: la persona a cui arriva il messaggio se il canale è suo (o se sai a chi chiedere di girarlo), altrimenti stringhe vuote.
- why: perché questo canale funziona per questa azienda (1-2 frasi concrete).
- steps: 3-4 passi pratici e brevi. Metodo: 1) primo messaggio = solo un aggancio umano (chi sei + una domanda sul loro problema), SENZA link
  e senza vendere; 2) se rispondono o dopo 2 giorni, follow-up con il link alla pagina con la soluzione personalizzata; 3) proposta di 15 minuti.
- opening_angle: la domanda-aggancio da fare nel primo messaggio: una domanda specifica sul problema più forte trovato nel loro sito,
  che faccia emergere il problema senza nominare cosa vende chi scrive (1-2 frasi, tono umano).`;

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

  // persone: il nome deve comparire davvero nel sito e i profili devono essere tra quelli trovati (niente invenzioni)
  const siteText = (hints.join(" ") + " " + profiles.map((p) => p.context).join(" ") + " " + input.pages.map((p) => p.content).join(" ")).toLowerCase();
  const known = new Map(profiles.map((p) => [p.url.toLowerCase().replace(/\/$/, ""), p]));
  const pick = (url: string, network: string) => {
    const p = known.get(url.toLowerCase().replace(/\/$/, ""));
    return p && p.network === network ? p.url : "";
  };
  result.people = result.people
    // solo chi decide: niente assistenza clienti, magazzino, logistica
    .filter((p) => !/customer|assistenza|care|support|magazzin|logistic|spedizion|stagist|intern\b/i.test(p.role))
    .filter((p) => siteText.includes(p.name.toLowerCase()) || p.name.split(/\s+/).every((w) => w.length < 2 || siteText.includes(w.toLowerCase())))
    .map((p) => ({
      ...p,
      instagram_url: pick(p.instagram_url, "instagram"),
      linkedin_url: pick(p.linkedin_url, "linkedin"),
      whatsapp_url: pick(p.whatsapp_url, "whatsapp"),
    }))
    .slice(0, 4);
  if (result.contact_plan.person_name && !result.people.some((p) => p.name === result.contact_plan.person_name)) {
    result.contact_plan.person_name = "";
    result.contact_plan.person_role = "";
  }
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

export const OUTREACH_STEPS = ["Aggancio", "Follow-up con soluzione", "Ultimo messaggio"] as const;

const outreachSchema = z.object({
  messages: z
    .array(
      z.object({
        channel: z.string().trim().min(1).max(40),
        subject: z.string().trim().max(200).optional().default(""),
        hook: z.string().trim().max(200).optional().default(""),
        body: z.string().trim().min(1).max(3000),
      }),
    )
    .min(1),
});
export type OutreachDraft = { channel: string; subject: string; body: string };

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
          hook: { type: "string", description: "Prima riga del messaggio: aggancio breve e personalizzato (solo primo contatto, altrimenti stringa vuota)" },
          body: { type: "string", description: "Il resto del messaggio, che continua dopo l'aggancio senza ripeterlo" },
        },
        required: ["channel", "subject", "hook", "body"],
        additionalProperties: false,
      },
    },
  },
  required: ["messages"],
  additionalProperties: false,
};

const CHANNEL_RULES: Record<string, string> = {
  instagram: "instagram (DM): massimo 300 caratteri, scritto come un DM vero tra persone, al massimo 1 emoji.",
  whatsapp: "whatsapp: massimo 300 caratteri, tono da messaggio tra professionisti che si danno del tu.",
  facebook: "facebook (Messenger della pagina): massimo 350 caratteri, tono cordiale.",
  linkedin: "linkedin (nota di collegamento o messaggio): massimo 280 caratteri.",
  sito: "sito (modulo contatti o chat): massimo 450 caratteri.",
  email: "email: oggetto breve, specifico e in minuscolo, che sembri una domanda tra persone (massimo 50 caratteri, niente clickbait); corpo di massimo 80 parole; nel primo messaggio firma solo con il nome, dal secondo con nome, ruolo e azienda.",
};

export async function generateOutreach(input: {
  companyName: string;
  sector: string;
  productDescription: string;
  senderName: string;
  senderCompany: string;
  senderRole: string;
  senderWebsite: string;
  senderOffer: string;
  bookingUrl: string;
  reportUrl: string;
  position: number | null;
  total: number;
  score: number;
  weakPoints: { title: string; explanation: string }[];
  openingAngle: string;
  channels: string[];
  /** a chi arriva il messaggio su ciascun canale (es. instagram → founder), se noto */
  recipients?: Record<string, { name: string; role: string } | undefined>;
  step: number;
  previous: string[];
  /** cosa ha risposto l'azienda al messaggio precedente, se l'utente lo incolla */
  reply?: string;
}): Promise<OutreachDraft[]> {
  const recipients = input.channels
    .map((c) => {
      const r = input.recipients?.[c];
      return r
        ? `- ${c}: arriva a ${r.name} (${r.role}). Salutalo per nome di battesimo ("Ciao ${r.name.split(" ")[0]},") e parlagli come a chi decide.`
        : input.step === 0
          ? `- ${c}: arriva all'account dell'azienda. Nessun nome e NON chiedere di girarlo a nessuno (farebbe capire che vuoi vendere).`
          : `- ${c}: arriva all'account dell'azienda (lo legge chi gestisce i messaggi). Nessun nome; chiedi in modo naturale di girarlo a chi segue il sito/marketing.`;
    })
    .join("\n");

  const who = [input.senderName, input.senderRole, input.senderCompany ? `di ${input.senderCompany}` : ""].filter(Boolean).join(", ");
  const reply = input.reply?.trim();

  const stepText =
    input.step === 0
      ? `AGGANCIO (primo messaggio). Obiettivo: farli rispondere. Deve sembrare il messaggio di una persona qualunque che ha notato
un problema usando il loro sito, NON di qualcuno che vende.
- hook (prima riga): solo saluto e nome, niente ruolo, niente azienda, niente "mi occupo di" (es. "Ciao Giulia, sono ${input.senderName.split(" ")[0] || "Carlo"}.").
  Se il messaggio va a una persona, salutala per nome di battesimo; altrimenti "Ciao, sono ...".
- body: racconta in 1-2 frasi, dal punto di vista di un cliente, cosa succede sul loro sito a causa del problema più forte trovato:
  "ho fatto un giro sul vostro sito come farebbe una cliente / mi sono messo nei panni di chi compra" + il momento concreto in cui ci si blocca
  (basato SOLO sui problemi trovati qui sotto, con dettagli specifici del loro sito). Poi UNA domanda che li fa preoccupare o incuriosire
  sul problema (es. se succede spesso, se lo sapevano, quanti clienti perdono lì).
- NON fingere di essere un cliente reale e non inventare acquisti, ordini o esigenze personali (es. "ho la pelle mista"): racconti un'esperienza
  di navigazione, non una storia falsa.
- VIETATO: chi sei professionalmente, cosa fai o vendi, soluzioni, consigli, link, report, analisi, classifiche, punteggi, "ho preparato",
  "posso mostrarti", call, prezzi. Chiudi con la domanda.
  Esempio di TONO (non copiarlo): "Ciao Giulia, sono Carlo. Ieri ho fatto un giro su BellaDerma come farebbe una cliente: ho aperto quattro creme
  viso e dopo un po' non avevo capito quale fosse quella giusta per me, così ho chiuso. Vi capita di vedere tanti carrelli lasciati a metà?"`
      : input.step === 1
        ? `FOLLOW-UP CON LA SOLUZIONE (secondo messaggio). hook = stringa vuota.
${reply ? `L'azienda ha risposto così al primo messaggio: """${reply.slice(0, 1200)}""". Rispondi in modo naturale a quello che hanno scritto (prima riga), poi collega la loro risposta al problema.` : "L'azienda non ha ancora risposto al primo messaggio: riprendi la domanda fatta senza ripeterla parola per parola (es. \"Ti riscrivo per la domanda sul...\")."}
- Collega al problema sollevato nel primo messaggio (vedi "Messaggi già inviati") e mantieni la stessa linea.
- Ora, e solo ora, di' chi sei in mezza frase e perché te ne sei accorto (es. "Ti dico perché te lo chiedevo: lavoro proprio su questo con ..."): ${who || "il mittente"}.
- Spiega in 1 frase che hai preparato per loro una pagina con come risolverlo, personalizzata sul loro sito, e metti il link.
- Puoi accennare in mezza frase cosa fai tu (${input.senderOffer || input.productDescription}), senza tono da pubblicità.
- Chiudi proponendo con leggerezza di sentirvi 15 minuti${input.bookingUrl ? ` (link per prenotare: ${input.bookingUrl})` : ""} o di usare il pulsante nella pagina.`
        : `ULTIMO MESSAGGIO. hook = stringa vuota. Due frasi al massimo, cortese: chiudi il ciclo, ricorda in mezza frase la pagina con la soluzione (con il link) e lascia la porta aperta, nessuna pressione.`;

  const prompt = `Scrivi messaggi di contatto B2B in italiano per l'azienda "${input.companyName}" (settore: ${input.sector}).
Devono sembrare scritti a mano da una persona vera, dal telefono: frasi corte, parole semplici, zero gergo da agenzia.

Chi scrive: ${who || "il mittente"}.
Cosa offre chi scrive (solo per essere coerente; nel primo messaggio NON va mai nominato né fatto intuire): ${input.senderOffer || input.productDescription}
${input.senderWebsite ? `Sito di chi scrive (solo nella firma dell'email, e solo dal secondo messaggio): ${input.senderWebsite}` : ""}

Cosa abbiamo visto sul loro sito (usalo per essere specifico, senza citare punteggi o classifiche nel primo messaggio):
- problemi principali: ${input.weakPoints.map((w) => `${w.title} (${w.explanation})`).join(" | ")}
- problema da sollevare: ${input.openingAngle || input.weakPoints[0]?.title || ""}
${input.step > 0 ? `- link alla pagina con la soluzione personalizzata: ${input.reportUrl}\n- confronto: posizione ${input.position ?? "?"} su ${input.total} aziende del settore (usalo solo se rafforza il messaggio)` : ""}

DESTINATARI
${recipients}

${stepText}
${input.previous.length ? `Messaggi già inviati a questa azienda (coerenza, non ripeterli):\n${input.previous.map((p) => `- ${p.slice(0, 600)}`).join("\n")}` : ""}

REGOLE
- Scrivi un messaggio per ciascuno di questi canali: ${input.channels.join(", ")}.
- ${input.channels.map((c) => CHANNEL_RULES[c] ?? c).join("\n- ")}
- Dai del tu. Vietate le frasi fatte: "spero tu stia bene", "mi permetto di", "Gentile", "analisi approfondita", "soluzioni innovative", "sinergie".
- Niente elenchi puntati, niente grassetti, niente firme lunghe (tranne nell'email).
- Non dire mai che sai se hanno aperto link o pagine. Non inventare dati che non sono qui sopra.
${input.step > 0 ? `- Inserisci il link esattamente così: ${input.reportUrl}` : "- NESSUN link, nessun indirizzo web."}
- Il campo channel deve essere esattamente uno di: ${input.channels.join(", ")}.`;

  const result = await generateJson({ prompt, schema: outreachJsonSchema, validator: outreachSchema, temperature: 0.8 });
  return result.messages
    .filter((m) => input.channels.includes(m.channel))
    .map((m) => {
      const hook = input.step === 0 ? m.hook.trim() : "";
      // l'AI a volte ripete l'aggancio all'inizio del corpo: in quel caso non lo duplichiamo
      let body = hook && !m.body.toLowerCase().startsWith(hook.toLowerCase().slice(0, 25)) ? `${hook}\n\n${m.body}` : m.body;
      // primo messaggio: mai link (sembrerebbe una truffa)
      if (input.step === 0) body = body.replace(/\s*(https?:\/\/|www\.)\S+/gi, "").trim();
      // dal follow-up in poi il link alla soluzione deve esserci sempre
      else if (!body.includes(input.reportUrl)) body = `${body}\n\nTi ho preparato qui come risolverlo, su misura per ${input.companyName}: ${input.reportUrl}`;
      return { channel: m.channel, subject: m.subject, body };
    });
}

// ---------------------------------------------------------------------
// E) Persone chiave cercate sul web (Google Search tramite Gemini)
// ---------------------------------------------------------------------

const webPeopleSchema = z.object({
  people: z
    .array(
      z.object({
        name: z.string().trim().min(3).max(120),
        role: z.string().trim().min(2).max(120),
        linkedin_url: z.string().trim().max(300).optional().default(""),
        instagram_url: z.string().trim().max(300).optional().default(""),
        source: z.string().trim().max(200).optional().default(""),
      }),
    )
    .max(8),
});
export type WebPerson = z.infer<typeof webPeopleSchema>["people"][number];

/**
 * Cerca su Google chi guida l'azienda (founder, titolare, marketing, commerciale) e i suoi profili
 * professionali/pubblici. Solo nomi, ruoli e profili: niente numeri di telefono o email personali.
 * Richiede la fatturazione Gemini attiva (la ricerca Google non è inclusa nel piano gratuito).
 */
export async function findPeopleOnWeb(
  input: { companyName: string; website: string; sector: string },
  debug?: (info: Record<string, unknown>) => void,
): Promise<WebPerson[]> {
  if (!process.env.GEMINI_API_KEY) return [];
  gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const domain = input.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
  // domanda breve e diretta: con richieste lunghe il modello fa troppe ricerche e supera i 45 secondi
  const prompt = `Chi sono fondatore/titolare/CEO, responsabile marketing e responsabile commerciale di "${input.companyName}" (${domain}, ${input.sector}, Italia)?
Massimo 5 persone, solo se trovate nei risultati di ricerca, che lavorano oggi in questa azienda (non omonimi). Mai inventare.
Rispondi SOLO con JSON: {"people":[{"name":"Nome Cognome","role":"ruolo","linkedin_url":"URL linkedin.com/in/... se nei risultati, altrimenti vuoto","instagram_url":"URL Instagram personale se nei risultati, altrimenti vuoto","source":"fonte breve"}]}
Se non trovi nessuno: {"people":[]}. Niente telefoni né email.`;

  let lastError: unknown = null;
  for (const model of GEMINI_MODELS.filter((m) => !m.includes("lite")).concat(GEMINI_MODELS.filter((m) => m.includes("lite")))) {
    try {
      const response = await gemini.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.1,
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          httpOptions: { timeout: 35_000 },
        },
      });
      const raw = response.text ?? "";
      const meta = response.candidates?.[0]?.groundingMetadata;
      const chunks = meta?.groundingChunks ?? [];
      const searched = chunks.length > 0 || (meta?.webSearchQueries?.length ?? 0) > 0 || Boolean(meta?.searchEntryPoint);
      debug?.({ model, raw: raw.slice(0, 1500), chunks: chunks.length, searched, metaKeys: Object.keys(meta ?? {}) });
      const text = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
      const parsed = webPeopleSchema.safeParse(JSON.parse(text || "{}"));
      if (!parsed.success) return [];
      const supported = (meta?.groundingSupports ?? []).map((s) => (s.segment?.text ?? "").toLowerCase()).join(" ");
      const titles = chunks.map((c) => `${c.web?.title ?? ""} ${c.web?.domain ?? ""}`.toLowerCase()).join(" ");
      return parsed.data.people
        // senza una ricerca Google confermata accettiamo solo persone con una fonte dichiarata (restano "da verificare")
        .filter((p) => searched || p.source.length > 2)
        .filter((p) => !/customer|assistenza|care|support|magazzin|logistic|stagist/i.test(p.role))
        // se Google indica quali parti della risposta vengono dai risultati, il nome deve essere tra quelle
        .filter((p) => !supported || supported.includes(p.name.toLowerCase().split(" ")[0]))
        .map((p) => ({
          ...p,
          linkedin_url: /^https:\/\/([a-z]{2,3}\.)?(www\.)?linkedin\.com\/in\/[^/?#\s]+\/?$/i.test(p.linkedin_url) && titles.includes("linkedin") ? p.linkedin_url : "",
          instagram_url: /^https:\/\/(www\.)?instagram\.com\/[a-z0-9._]{2,30}\/?$/i.test(p.instagram_url) ? p.instagram_url : "",
        }))
        .slice(0, 5);
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number }).status;
      debug?.({ model, error: String((err as Error).message).slice(0, 300), status });
      console.error(`Ricerca persone ${model}: ${status ?? ""} ${(err instanceof Error ? err.message : "").slice(0, 200)}`);
      if (status === 400 && /api key|API_KEY/i.test(String(err))) break;
    }
  }
  const status = (lastError as { status?: number } | null)?.status;
  if (status === 429) {
    throw new UserError("La ricerca sul web richiede la fatturazione Gemini attiva (la ricerca Google non è nel piano gratuito).");
  }
  throw new UserError("Ricerca delle persone sul web non riuscita. Riprova tra poco.");
}

// ---------------------------------------------------------------------
// F) Radar: profilo suggerito e risposte ai post
// ---------------------------------------------------------------------

const radarProfileSchema = z.object({
  sectors: z.array(z.string().trim().min(2).max(80)).min(1).max(6),
  topics: z.array(z.string().trim().min(2).max(80)).min(2).max(10),
  roles: z.array(z.string().trim().min(2).max(60)).min(1).max(6),
});

/** Propone settori, argomenti e ruoli da monitorare partendo da cosa vende l'utente. */
export async function suggestRadarProfile(input: { offer: string; sectors: string[] }) {
  const prompt = `Chi vende questo: """${input.offer}"""${input.sectors.length ? `\nSettori su cui ha già lavorato: ${input.sectors.join(", ")}` : ""}
Vuole trovare online post, richieste e annunci di aziende che hanno bisogno di quello che vende.
Proponi:
- sectors: 2-5 tipi di aziende target, specifici (es. "e-commerce skincare", "farmacie online"), non generici
- topics: 5-8 argomenti/problemi/parole che quelle aziende usano quando hanno il bisogno (es. "clienti indecisi su quale prodotto", "tasso di conversione basso", "quiz prodotto")
- roles: 2-4 ruoli di chi decide
Tutto in italiano, brevi.`;
  return generateJson({
    prompt,
    schema: {
      type: "object",
      properties: {
        sectors: { type: "array", items: { type: "string" } },
        topics: { type: "array", items: { type: "string" } },
        roles: { type: "array", items: { type: "string" } },
      },
      required: ["sectors", "topics", "roles"],
      additionalProperties: false,
    },
    validator: radarProfileSchema,
    temperature: 0.4,
  });
}

/** Risposta a un'opportunità del Radar: commento pubblico al post oppure messaggio privato. */
export async function generateRadarReply(input: {
  mode: "commento" | "messaggio";
  platform: string;
  signal: string;
  author: string;
  company: string;
  excerpt: string;
  offer: string;
  senderName: string;
  senderRole: string;
  senderCompany: string;
}): Promise<string> {
  const who = [input.senderName, input.senderRole, input.senderCompany ? `di ${input.senderCompany}` : ""].filter(Boolean).join(", ");
  const task =
    input.mode === "commento"
      ? `Scrivi un COMMENTO PUBBLICO da pubblicare sotto questo post (${input.platform}).
Obiettivo: attirare l'attenzione dell'autore e di chi legge dimostrando competenza, NON vendere.
- 2-4 frasi, tono umano e diretto, in prima persona.
- Dai un consiglio concreto o un punto di vista utile e specifico su quello che dice il post (qualcosa che solo chi ci lavora sa).
- Puoi dire in mezza frase che ci lavori ogni giorno, senza nominare prodotti, prezzi o link.
- Chiudi con una domanda o un invito leggero a sentirsi in privato (es. "se ti va ti scrivo come l'abbiamo risolto").
- Niente hashtag, al massimo 1 emoji.`
      : `Scrivi un MESSAGGIO PRIVATO (DM o email breve) a ${input.author || input.company || "chi ha pubblicato"} partendo da questo contenuto.
- Prima riga: aggancio a quello che hanno pubblicato (es. "ho visto che cercate..." / "ho letto del vostro lancio di...").
- Poi 1-2 frasi: perché te ne sei accorto e come potresti aiutarli in modo concreto, senza tono da pubblicità.
- Chiudi con una domanda semplice. Niente link. Massimo 450 caratteri.`;
  const prompt = `${task}

Contenuto (${input.signal}) di ${input.author || "?"}${input.company ? ` (${input.company})` : ""}:
"""${input.excerpt}"""

Chi scrive: ${who || "il mittente"}. Cosa offre (per essere coerente, non per fare pubblicità): ${input.offer}
Italiano, dai del tu, niente frasi fatte ("spero tu stia bene", "mi permetto di"). Non inventare dati.`;
  const res = await generateJson({
    prompt,
    schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false },
    validator: z.object({ text: z.string().trim().min(10).max(1500) }),
    temperature: 0.8,
  });
  return res.text.replace(/\s*https?:\/\/\S+/g, "").trim();
}
