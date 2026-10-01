// Client Supabase usato SOLO lato server, con la service role key.
// "server-only" fa fallire la build se per errore lo importi in un componente client.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  // l'URL non è segreto: se manca si usa quello del progetto Supabase "yeppo"
  const url = process.env.SUPABASE_URL || "https://djzzjybrcknrvvovvlpq.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Configurazione mancante: imposta SUPABASE_SERVICE_ROLE_KEY.");
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Messaggio di errore leggibile a partire da un errore qualsiasi. */
export function friendlyError(err: unknown, fallback = "Si è verificato un errore. Riprova tra poco."): string {
  if (err instanceof Error && err.message.startsWith("Configurazione mancante")) return err.message;
  if (err instanceof UserError) return err.message;
  return fallback;
}

/** Errore con un messaggio già pensato per l'utente (in italiano). */
export class UserError extends Error {}
