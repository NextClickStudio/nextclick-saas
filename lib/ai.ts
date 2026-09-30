// Chiamate a Google Gemini: schemi di output, prompt (in italiano) e validazione.
import "server-only";
import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { z } from "zod";
import { UserError } from "@/lib/db";

// Nome del modello in un punto solo: per cambiarlo modifica solo questa riga.
export const GEMINI_MODEL = "gemini-2.5-flash";

let client: GoogleGenAI | null = null;
function gemini(): GoogleGenAI {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new UserError("Configurazione mancante: imposta GEMINI_API_KEY.");
  client = new GoogleGenAI({ apiKey });
  return client;
}

/**
 * Chiama Gemini chiedendo JSON con uno schema preciso, poi valida con zod.
 * Se la risposta non è valida riprova una volta; poi restituisce un errore leggibile.
 */
async function generateJson<T>(opts: {
  prompt: string;
  schema: Schema;
  validator: z.ZodType<T>;
  temperature: number;
}): Promise<T> {
  let lastProblem = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await gemini().models.generateContent({
        model: GEMINI_MODEL,
        contents: opts.prompt,
        config: {
          temperature: opts.temperature,
          responseMimeType: "application/json",
          responseSchema: opts.schema,
        },
      });
      const parsed = opts.validator.safeParse(JSON.parse(response.text ?? ""));
      if (parsed.success) return parsed.data;
      lastProblem = "risposta AI non valida";
      console.error("Gemini: JSON non valido", parsed.error.issues.slice(0, 5));
    } catch (err) {
      if (err instanceof UserError) throw err;
      lastProblem = "errore di comunicazione con l'AI";
      console.error("Gemini: errore", err);
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

const symptomGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    symptom: { type: Type.STRING, description: "Il sintomo visibile, in 1-3 frasi" },
    index_name: {
      type: Type.STRING,
      description: 'Nome breve per una classifica pubblica di settore, es. "Indice della consulenza online"',
    },
    criteria: {
      type: Type.ARRAY,
      minItems: "6",
      maxItems: "10",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          how_to_check: { type: Type.STRING },
          weight: { type: Type.INTEGER, description: "Importanza da 1 a 5" },
        },
        required: ["name", "description", "how_to_check", "weight"],
        propertyOrdering: ["name", "description", "how_to_check", "weight"],
      },
    },
  },
  required: ["symptom", "index_name", "criteria"],
  propertyOrdering: ["symptom", "index_name", "criteria"],
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

  return generateJson({ prompt, schema: symptomGeminiSchema, validator: symptomResultSchema, temperature: 0.6 });
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
});
export type Evaluation = z.infer<typeof evaluationSchema>;

const evaluationGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    scores: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          criterion_id: { type: Type.STRING },
          score: { type: Type.INTEGER, description: "Da 0 a 10" },
          evidence: { type: Type.STRING },
        },
        required: ["criterion_id", "score", "evidence"],
        propertyOrdering: ["criterion_id", "score", "evidence"],
      },
    },
    weak_points: {
      type: Type.ARRAY,
      minItems: "3",
      maxItems: "3",
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          explanation: { type: Type.STRING },
          evidence: { type: Type.STRING },
        },
        required: ["title", "explanation", "evidence"],
        propertyOrdering: ["title", "explanation", "evidence"],
      },
    },
    summary: { type: Type.STRING },
  },
  required: ["scores", "weak_points", "summary"],
  propertyOrdering: ["scores", "weak_points", "summary"],
};

export async function evaluateWebsite(input: {
  productDescription: string;
  symptom: string;
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

ISTRUZIONI
- Per OGNI criterio (usa esattamente il suo id) assegna un punteggio intero da 0 a 10 (10 = eccellente, sintomo assente) e una prova concreta: cosa hai visto o NON hai visto nel testo, citando brevemente la pagina (es. "In homepage...", "Nella pagina prodotto...").
- Non inventare: se l'informazione non è nel testo, dillo e assegna un punteggio prudente.
- Poi identifica i 3 punti in cui questo sito perde più clienti. Spiegali in modo concreto e rispettoso, come li leggerebbe il titolare dell'azienda: titolo breve, spiegazione (2-3 frasi) e prova.
- Non nominare mai il prodotto di chi chiede l'analisi e non fare pubblicità: descrivi solo il problema.
- Scrivi un riassunto di 2 frasi.
- Non riportare email, numeri di telefono o nomi di persone.
Scrivi tutto in italiano, dando del "tu" al titolare.`;

  const ids = new Set(input.criteria.map((c) => c.id));
  // lo schema zod controlla anche che ci sia un punteggio per ogni criterio
  const validator = evaluationSchema.refine(
    (v) => ids.size > 0 && [...ids].every((id) => v.scores.some((s) => s.criterion_id === id)),
    { message: "punteggi mancanti per alcuni criteri" },
  );

  const result = await generateJson({ prompt, schema: evaluationGeminiSchema, validator, temperature: 0.2 });
  // tieni solo i criteri conosciuti, una volta ciascuno, con punteggi interi
  const seen = new Set<string>();
  result.scores = result.scores
    .filter((s) => ids.has(s.criterion_id) && !seen.has(s.criterion_id) && seen.add(s.criterion_id))
    .map((s) => ({ ...s, score: Math.round(s.score) }));
  result.weak_points = result.weak_points.slice(0, 3);
  return result;
}
