// Piccoli aiuti per le route API: lettura del body con zod e risposte d'errore leggibili.
import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { friendlyError, UserError } from "@/lib/db";

// messaggi di validazione predefiniti in italiano
z.config(z.locales.it());

/** Legge il body JSON e lo valida con lo schema zod. */
export async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new UserError("Richiesta non valida.");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new UserError(first?.message || "Dati non validi: controlla i campi.");
  }
  return parsed.data;
}

/** Esegue la route e trasforma qualsiasi errore in un messaggio comprensibile. */
export async function handle(fn: () => Promise<unknown>): Promise<Response> {
  try {
    const result = await fn();
    if (result instanceof Response) return result;
    return NextResponse.json(result ?? { ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dati non validi: controlla i campi." }, { status: 400 });
    }
    if (!(err instanceof UserError)) console.error(err);
    const status = err instanceof UserError ? 400 : 500;
    return NextResponse.json({ error: friendlyError(err) }, { status });
  }
}

export const uuid = z.string().uuid({ message: "Identificativo non valido." });

/** Criterio come arriva dai form. */
export const criterionInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Ogni criterio deve avere un nome.").max(120),
  description: z.string().trim().min(1, "Ogni criterio deve avere una descrizione.").max(600),
  how_to_check: z.string().trim().min(1, "Indica come verificare ogni criterio.").max(600),
  weight: z.coerce.number().int().min(1).max(5),
});

export const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "L'URL della CTA deve iniziare con https://")
  .transform((v) => (v === "" ? null : v));
