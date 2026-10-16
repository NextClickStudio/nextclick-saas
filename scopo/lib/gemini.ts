/**
 * Client minimo per la Gemini API (REST, niente SDK).
 * La chiave si legge dalla prima variabile d'ambiente presente tra quelle
 * usate di solito; il modello si può scegliere con GEMINI_MODEL.
 */

const API = "https://generativelanguage.googleapis.com/v1beta/models";

export const GEMINI_KEY_ENVS = ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"] as const;

/** Se un modello non esiste (404) si prova il successivo. */
const FALLBACK_MODELS = ["gemini-flash-latest", "gemini-2.5-flash"];

export function geminiKey(): { key: string; env: string } | null {
  for (const env of GEMINI_KEY_ENVS) {
    const key = process.env[env]?.trim();
    if (key) return { key, env };
  }
  return null;
}

function modelCandidates(): string[] {
  const preferred = process.env.GEMINI_MODEL?.trim();
  return [...new Set([preferred, ...FALLBACK_MODELS].filter((m): m is string => Boolean(m)))];
}

/** Il primo modello che ha risposto, per non riprovare quelli che non esistono. */
let workingModel: string | null = null;

/** Sottoinsieme OpenAPI usato da `responseSchema`. */
export type GeminiSchema =
  | { type: "STRING" }
  | { type: "INTEGER" }
  | { type: "ARRAY"; items: GeminiSchema }
  | { type: "OBJECT"; properties: Record<string, GeminiSchema>; required: string[] };

export class GeminiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type GenerateResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
  }>;
  promptFeedback?: { blockReason?: string };
};

async function callModel(model: string, key: string, body: unknown, timeoutMs: number): Promise<GenerateResponse> {
  const res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    let reason = `${res.status}`;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data.error?.message) reason = data.error.message;
    } catch {
      // corpo non JSON: teniamo lo status
    }
    throw new GeminiError(`Gemini ${model}: ${reason}`, res.status);
  }
  return (await res.json()) as GenerateResponse;
}

/**
 * Chiede a Gemini una risposta JSON che rispetta `schema` e la passa a `parse`
 * (che deve lanciare se la forma non torna).
 */
export async function generateJson<T>(
  prompt: string,
  schema: GeminiSchema,
  parse: (value: unknown) => T,
  { timeoutMs = 40_000 }: { timeoutMs?: number } = {},
): Promise<{ value: T; model: string }> {
  const auth = geminiKey();
  if (!auth) throw new GeminiError("No Gemini API key configured", 0);

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.4 },
  };

  const models = workingModel ? [workingModel] : modelCandidates();
  let lastError: unknown = null;
  for (const model of models) {
    let data: GenerateResponse;
    try {
      data = await callModel(model, auth.key, body, timeoutMs);
    } catch (err) {
      lastError = err;
      if (err instanceof GeminiError && err.status === 404) continue;
      throw err;
    }
    workingModel = model;
    if (data.promptFeedback?.blockReason) {
      throw new GeminiError(`Gemini blocked the prompt (${data.promptFeedback.blockReason})`, 200);
    }
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) throw new GeminiError(`Gemini returned no text (${data.candidates?.[0]?.finishReason ?? "unknown"})`, 200);
    return { value: parse(JSON.parse(text)), model };
  }
  throw lastError ?? new GeminiError("No Gemini model available", 404);
}

export function logAiError(where: string, err: unknown) {
  if (err instanceof GeminiError) {
    console.warn(`[ai:${where}] ${err.message}`);
  } else {
    console.warn(`[ai:${where}]`, err);
  }
}
