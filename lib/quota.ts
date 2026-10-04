// Limiti giornalieri di uso dell'AI per utente: proteggono i costi da abusi (o da clic ripetuti all'infinito).
import "server-only";
import { db, UserError } from "@/lib/db";

export const AI_DAILY_LIMITS = {
  analyze: 150, // analisi di siti (in più al limite per sessione)
  draft: 150, // messaggi di outreach scritti dall'AI
  people: 60, // ricerche Google delle persone chiave
  discover: 20, // ricerche automatiche di aziende
  criteria: 30, // generazione sintomo e criteri
  reply: 100, // commenti/DM del Radar
  suggest: 15, // profilo Radar compilato dall'AI
  meme: 40, // copioni dei meme social (uso interno)
} as const;

export type AiKind = keyof typeof AI_DAILY_LIMITS;

const LABEL: Record<AiKind, string> = {
  analyze: "analisi",
  draft: "messaggi scritti dall'AI",
  people: "ricerche di persone",
  discover: "ricerche di aziende",
  criteria: "generazioni di criteri",
  reply: "risposte del Radar",
  suggest: "profili compilati dall'AI",
  meme: "generazioni di meme",
};

/** Consuma una unità del limite di oggi; se è finito lancia un errore leggibile. */
export async function consumeAiQuota(userId: string, kind: AiKind): Promise<void> {
  const { data, error } = await db().rpc("use_ai_quota", { p_user: userId, p_kind: kind, p_max: AI_DAILY_LIMITS[kind] });
  if (error) throw error;
  if (data !== true) {
    throw new UserError(`Hai raggiunto il limite di oggi (${AI_DAILY_LIMITS[kind]} ${LABEL[kind]}). Riprova domani.`);
  }
}
