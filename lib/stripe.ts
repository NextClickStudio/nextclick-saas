// Pagamenti con Stripe Checkout, senza SDK: due chiamate HTTP e la verifica della firma del webhook.
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { UserError } from "@/lib/db";

const API = "https://api.stripe.com/v1";

function secretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new UserError("I pagamenti non sono ancora attivi. Riprova a breve o contattaci.");
  return key;
}

/** Stripe vuole i parametri come form "a[b][c]=valore". */
function toForm(obj: Record<string, unknown>, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (typeof v === "object") toForm(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe<T>(path: string, method: "GET" | "POST", body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body ? toForm(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    console.error("Stripe", json);
    throw new UserError("Il pagamento non è disponibile in questo momento. Riprova tra poco.");
  }
  return json as T;
}

export type CheckoutSession = { id: string; url: string; payment_status: string; metadata?: Record<string, string> };

export async function createCheckout(opts: {
  userId: string;
  email: string;
  planId: string;
  planName: string;
  amountCents: number;
  credits: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutSession> {
  return stripe<CheckoutSession>("/checkout/sessions", "POST", {
    mode: "payment",
    customer_email: opts.email,
    client_reference_id: opts.userId,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === "1" ? "true" : "false" },
    tax_id_collection: { enabled: "true" },
    billing_address_collection: "required",
    invoice_creation: { enabled: "true" },
    line_items: {
      0: {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: opts.amountCents,
          product_data: { name: `Yeppo ${opts.planName} – ${opts.credits} sessioni` },
        },
      },
    },
    metadata: { user_id: opts.userId, plan: opts.planId, credits: opts.credits },
  });
}

export async function getCheckout(id: string): Promise<CheckoutSession> {
  return stripe<CheckoutSession>(`/checkout/sessions/${encodeURIComponent(id)}`, "GET");
}

/** Verifica la firma "Stripe-Signature" del webhook (tolleranza 5 minuti). */
export function verifyWebhook(payload: string, header: string | null): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const signatures = header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  return signatures.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

export const paymentsEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY);
