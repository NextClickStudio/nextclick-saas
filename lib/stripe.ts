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

/** Errore restituito da Stripe (il messaggio tecnico resta nei log, all'utente arriva quello leggibile). */
class StripeError extends UserError {
  constructor(public stripeMessage: string) {
    super("Il pagamento non è disponibile in questo momento. Riprova tra poco.");
  }
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
    throw new StripeError(String(json?.error?.message ?? ""));
  }
  return json as T;
}

export type CheckoutSession = {
  id: string;
  url: string;
  mode?: "payment" | "subscription";
  status?: string;
  payment_status: string;
  customer?: string | null;
  subscription?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string>;
};

const common = (opts: { userId: string; email: string; customerId?: string | null; successUrl: string; cancelUrl: string }) => ({
  ...(opts.customerId ? { customer: opts.customerId } : { customer_email: opts.email }),
  client_reference_id: opts.userId,
  success_url: opts.successUrl,
  cancel_url: opts.cancelUrl,
  automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === "1" ? "true" : "false" },
  tax_id_collection: { enabled: "true" },
  billing_address_collection: "required",
  allow_promotion_codes: "true",
  locale: "it",
});

/**
 * Crea la pagina di pagamento. Gli account Stripe nuovi hanno "Managed Payments" attivo di default
 * (Stripe venditore al posto tuo, con le sue regole sulle tasse): Yeppo usa il pagamento standard,
 * quindi lo disattiva per la singola richiesta; se l'account non conosce quel parametro, riprova senza.
 */
async function createSession(body: Record<string, unknown>): Promise<CheckoutSession> {
  try {
    return await stripe<CheckoutSession>("/checkout/sessions", "POST", { ...body, managed_payments: { enabled: "false" } });
  } catch (err) {
    if (err instanceof StripeError && /managed_payments/i.test(err.stripeMessage) && /unknown|not supported|unrecognized/i.test(err.stripeMessage)) {
      return stripe<CheckoutSession>("/checkout/sessions", "POST", body);
    }
    throw err;
  }
}

/** Abbonamento mensile a un piano. */
export async function createSubscriptionCheckout(opts: {
  userId: string;
  email: string;
  customerId?: string | null;
  planId: string;
  planName: string;
  amountCents: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutSession> {
  return createSession({
    mode: "subscription",
    ...common(opts),
    line_items: {
      0: {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: opts.amountCents,
          recurring: { interval: "month" },
          product_data: { name: `Yeppo ${opts.planName}` },
        },
      },
    },
    subscription_data: { metadata: { user_id: opts.userId, plan: opts.planId } },
    metadata: { user_id: opts.userId, plan: opts.planId, kind: "subscription" },
  });
}

/** Acquisto singolo (sessioni extra). */
export async function createCheckout(opts: {
  userId: string;
  email: string;
  customerId?: string | null;
  planId: string;
  planName: string;
  amountCents: number;
  credits: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutSession> {
  return createSession({
    mode: "payment",
    ...common(opts),
    invoice_creation: { enabled: "true" },
    line_items: {
      0: {
        quantity: 1,
        price_data: { currency: "eur", unit_amount: opts.amountCents, product_data: { name: opts.planName } },
      },
    },
    metadata: { user_id: opts.userId, plan: opts.planId, credits: opts.credits, kind: "payment" },
  });
}

export async function getCheckout(id: string): Promise<CheckoutSession> {
  return stripe<CheckoutSession>(`/checkout/sessions/${encodeURIComponent(id)}`, "GET");
}

export type Subscription = {
  id: string;
  status: string;
  customer: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  metadata?: Record<string, string>;
  items?: { data: { current_period_end?: number }[] };
};

export async function getSubscription(id: string): Promise<Subscription> {
  return stripe<Subscription>(`/subscriptions/${encodeURIComponent(id)}`, "GET");
}

/** Prodotto Stripe del piano (cercato per metadato, creato la prima volta). */
async function planProduct(plan: { id: string; name: string }): Promise<string> {
  const query = encodeURIComponent(`metadata['yeppo_plan']:'${plan.id}'`);
  const found = await stripe<{ data: { id: string }[] }>(`/products/search?query=${query}`, "GET");
  if (found.data[0]) return found.data[0].id;
  const created = await stripe<{ id: string }>("/products", "POST", { name: `Yeppo ${plan.name}`, metadata: { yeppo_plan: plan.id } });
  return created.id;
}

/**
 * Cambia il piano di un abbonamento attivo: Stripe calcola la differenza (proporzionale ai giorni rimasti)
 * e la addebita subito, oppure la tiene come credito se il nuovo piano costa meno.
 */
export async function changeSubscriptionPlan(subId: string, plan: { id: string; name: string; priceCents: number }): Promise<Subscription> {
  const sub = await stripe<{ items: { data: { id: string }[] } }>(`/subscriptions/${encodeURIComponent(subId)}`, "GET");
  const item = sub.items.data[0];
  if (!item) throw new UserError("Abbonamento non trovato: contattaci.");
  const product = await planProduct(plan);
  return stripe<Subscription>(`/subscriptions/${encodeURIComponent(subId)}`, "POST", {
    items: { 0: { id: item.id, price_data: { currency: "eur", unit_amount: plan.priceCents, recurring: { interval: "month" }, product } } },
    proration_behavior: "always_invoice",
    cancel_at_period_end: "false",
    metadata: { plan: plan.id },
  });
}

/** Fine del periodo pagato (Stripe la espone sull'abbonamento o sulle sue voci, a seconda della versione). */
export function periodEnd(sub: Subscription): string | null {
  const t = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  return t ? new Date(t * 1000).toISOString() : null;
}

/** Portale clienti di Stripe: cambio carta, fatture, disdetta. */
export async function createPortal(customerId: string, returnUrl: string): Promise<{ url: string }> {
  return stripe<{ url: string }>("/billing_portal/sessions", "POST", { customer: customerId, return_url: returnUrl });
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
