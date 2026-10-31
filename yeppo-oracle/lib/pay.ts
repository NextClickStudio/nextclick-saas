// Checkout in SOL through the yr-pay edge function, and the license key kept in this browser.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { readLocal, rpc } from "./supabase";

export type PayPlan = { id: string; name: string; days: number; sol: number };
export type Order = { id: string; plan: PayPlan; sol: string; wallet: string; ref: string; url: string; expires: number };
export type License = { ok: boolean; plan?: string; until?: number };

export async function pay<T>(body: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/yr-pay`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify(body),
  });
  const j = (await r.json()) as T & { error?: string };
  if (!r.ok || j.error) throw new Error(j.error ?? "Something went wrong");
  return j;
}

export const savedKey = () => readLocal<string | null>("yo:key", null);
export const license = (key: string) => rpc<License>("yr_license", { p_key: key });
