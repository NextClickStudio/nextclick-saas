// Login degli utenti con Supabase Auth (cookie di sessione gestiti da @supabase/ssr).
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/config";
import { db, UserError } from "@/lib/db";

/** Client Supabase legato ai cookie della richiesta corrente (solo per l'autenticazione). */
export async function authClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // chiamato da un Server Component: i cookie li aggiorna il proxy
        }
      },
    },
  });
}

export type CurrentUser = { id: string; email: string };

/** Utente collegato, oppure null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await authClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: String(claims.email ?? "") };
}

/** Per le API: utente collegato oppure errore 401. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Sessione scaduta: effettua di nuovo l'accesso.");
  return user;
}

export class AuthError extends UserError {}

export type Account = {
  user_id: string;
  full_name: string | null;
  company_name: string | null;
  free_sessions: number;
  credits: number;
  unlimited: boolean;
  created_at: string;
  sender_role: string | null;
  sender_pitch: string | null;
  booking_url: string | null;
  company_website: string | null;
  company_offer: string | null;
  onboarded_at: string | null;
};

/** Il profilo è completo quando l'AI ha tutto per firmare i messaggi e presentarti nel report. */
export function profileComplete(a: Account): boolean {
  return Boolean(a.full_name && a.company_name && a.company_website && a.company_offer);
}

/** Profilo e crediti dell'utente (lo crea se manca). */
export async function getAccount(userId: string): Promise<Account> {
  const { data, error } = await db().from("accounts").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (data) return data as Account;
  const { data: created, error: insError } = await db()
    .from("accounts")
    .upsert({ user_id: userId }, { onConflict: "user_id" })
    .select("*")
    .single();
  if (insError) throw insError;
  return created as Account;
}

/** Sessioni ancora disponibili (gratuite + acquistate). */
export function availableSessions(a: Account): number {
  return a.unlimited ? Infinity : a.free_sessions + a.credits;
}
