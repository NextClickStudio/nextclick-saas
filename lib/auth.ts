// Firma e verifica del cookie di login.
// Usa Web Crypto (HMAC-SHA256), disponibile sia nelle route sia nel proxy.
// Il segreto è la stessa ADMIN_PASSWORD: se la cambi, tutti i login vengono invalidati.

export const AUTH_COOKIE = "zeppo_session";
export const SESSION_DAYS = 30;

const encoder = new TextEncoder();

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Confronto a tempo costante, per non rivelare quanti caratteri coincidono. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function adminPassword(): string | null {
  const p = process.env.ADMIN_PASSWORD;
  return p && p.length > 0 ? p : null;
}

/** Crea il valore del cookie: "scadenza.firma". */
export async function createSessionToken(): Promise<string> {
  const secret = adminPassword();
  if (!secret) throw new Error("ADMIN_PASSWORD non impostata");
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `admin.${expires}`;
  return `${payload}.${await hmacHex(payload, secret)}`;
}

/** true se il cookie è valido e non scaduto. */
export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  const secret = adminPassword();
  if (!secret || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "admin") return false;
  const expires = Number(parts[1]);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = await hmacHex(`${parts[0]}.${parts[1]}`, secret);
  return safeEqual(parts[2], expected);
}

/** Verifica la password inserita nel form di login. */
export async function checkPassword(input: string): Promise<boolean> {
  const secret = adminPassword();
  if (!secret) return false;
  // confronto tra hash, così anche lunghezze diverse richiedono lo stesso tempo
  const [a, b] = await Promise.all([hmacHex(input, "zeppo"), hmacHex(secret, "zeppo")]);
  return safeEqual(a, b);
}
