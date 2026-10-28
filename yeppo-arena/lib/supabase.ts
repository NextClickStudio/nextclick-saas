import { createClient } from "@supabase/supabase-js";
import { ARENA_FN, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import type { Session } from "./types";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function arena<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ARENA_FN, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new Error("Connessione persa, riprova");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error ?? "Errore del server, riprova");
  return data as T;
}

// localStorage can throw (private mode, blocked storage): never let it break the page.
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const sessionKey = (code: string) => `yeppo:s:${code}`;
export const loadSession = (code: string) => readLocal<Session | null>(sessionKey(code), null);
export const saveSession = (code: string, s: Session | null) => writeLocal(sessionKey(code), s);
