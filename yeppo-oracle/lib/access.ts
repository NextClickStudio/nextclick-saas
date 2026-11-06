// Server-only helpers shared by yeppo.it's API routes: the secret that proves the server to the database, and the
// Pro key check (yr_access), kept a minute per key and device.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

// yeppo.it's own server proves itself to the database with a secret (Vercel environment variable YEPPO_API_SECRET):
// the creator history and the money trail answer nobody else once the database knows the same secret
export const DB_HEADERS: Record<string, string> = {
  apikey: SUPABASE_ANON_KEY,
  authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "content-type": "application/json",
  ...(process.env.YEPPO_API_SECRET ? { "x-yeppo-secret": process.env.YEPPO_API_SECRET } : {}),
};

const KEY = /^YEP-[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{5}$/;
const DEV = /^[0-9a-f-]{36}$/;
export type Access = { pro: boolean; reason?: string; owner?: boolean };
const access = new Map<string, { t: number; v: Access }>();

/** does this key unlock yeppo on this device (yr_access)? Kept a minute per key and device. When the database does
 *  not answer, a key it confirmed in the last day keeps working; a key it never confirmed waits, so a made-up key can't
 *  get in while the database is down. */
export async function accessOf(key: string | null, dev: string | null): Promise<Access> {
  const k = key && KEY.test(key) ? key : "";
  const d = dev && DEV.test(dev) ? dev : "";
  // no key (or a malformed one): one shared answer, so made-up device ids never reach the database
  const ck = k ? `${k}:${d}` : "";
  const hit = access.get(ck);
  if (hit && Date.now() - hit.t < 60_000) return hit.v;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_access`, {
      method: "POST",
      headers: DB_HEADERS,
      body: JSON.stringify({ p_key: k, p_dev: d || null }),
      signal: AbortSignal.timeout(2500),
    });
    if (!r.ok) throw new Error(`${r.status}`);
    const j = (await r.json()) as { pro?: boolean; reason?: string; owner?: boolean };
    const v = { pro: !!j.pro, reason: j.reason, owner: !!j.owner };
    if (access.size > 5000) access.clear();
    access.set(ck, { t: Date.now(), v });
    return v;
  } catch {
    if (hit && Date.now() - hit.t < 86_400_000) return hit.v;
    return { pro: false, reason: k ? "busy" : "nokey" };
  }
}

export const LOCKED: Record<string, string> = {
  nokey: "yeppo needs a Pro key. Get one below, or paste yours.",
  unknown: "That key doesn't exist. Check it, or paste the one from your payment.",
  expired: "Your Pro key has expired. Renew it on yeppo.it/pricing: the same key keeps working.",
  devices: "This key is already used on 3 devices. Write to info@yeppo.it to move it.",
  nodevice: "Reload the extension, then try again.",
  busy: "yeppo can't check your key this second. It tries again by itself.",
};

