// Funzioni usate dai componenti client per parlare con le API.

/** Chiama una API interna e restituisce i dati o lancia un Error con messaggio leggibile. */
export async function api<T = unknown>(url: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? (options.body ? "POST" : "GET"),
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("Connessione assente o server non raggiungibile.");
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* risposta vuota o non JSON */
  }
  if (res.status === 401) {
    // ricarica completa voluta: la sessione è scaduta
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
    throw new Error("Sessione scaduta.");
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error;
    throw new Error(msg || (res.status === 504 ? "Il server ha impiegato troppo tempo. Riprova." : "Si è verificato un errore. Riprova."));
  }
  return data as T;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
