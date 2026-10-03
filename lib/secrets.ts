// Segreti generati dall'app (chiavi notifiche, chiave interna dei job) salvati nel database, letti solo dal server.
import "server-only";
import { db } from "@/lib/db";

/** Legge un segreto; se non esiste lo crea con il valore prodotto da `create` (una volta sola). */
export async function getOrCreateSecret(key: string, create: () => string): Promise<string> {
  const supabase = db();
  const { data } = await supabase.from("app_secrets").select("value").eq("key", key).maybeSingle();
  if (data?.value) return data.value as string;
  await supabase.from("app_secrets").upsert({ key, value: create() }, { onConflict: "key", ignoreDuplicates: true });
  const { data: again, error } = await supabase.from("app_secrets").select("value").eq("key", key).single();
  if (error) throw error;
  return again.value as string;
}
