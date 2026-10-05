// Abbonamenti: attivazione, rinnovo mensile delle sessioni e disdetta (usato dal webhook e dal ritorno da Stripe).
import "server-only";
import { db, UserError } from "@/lib/db";
import { findPlan } from "@/lib/plans";
import { changeSubscriptionPlan, getSubscription, periodEnd, type CheckoutSession } from "@/lib/stripe";

/** Attiva il piano dopo il pagamento dell'abbonamento (idempotente: rifarlo non aggiunge sessioni). */
export async function activateFromCheckout(session: CheckoutSession): Promise<boolean> {
  if (session.mode !== "subscription" || !session.subscription) return false;
  const userId = session.client_reference_id || session.metadata?.user_id;
  const plan = findPlan(session.metadata?.plan);
  if (!userId || !plan) return false;
  const { data: acc } = await db().from("accounts").select("stripe_subscription_id").eq("user_id", userId).maybeSingle();
  if (acc?.stripe_subscription_id === session.subscription) return true; // già attivato
  const sub = await getSubscription(session.subscription);
  const { error } = await db()
    .from("accounts")
    .update({
      plan: plan.id,
      plan_status: sub.status,
      plan_sessions_left: plan.sessions,
      plan_period_end: periodEnd(sub),
      stripe_customer_id: session.customer ?? sub.customer,
      stripe_subscription_id: session.subscription,
    })
    .eq("user_id", userId);
  if (error) throw error;
  await db().from("purchases").upsert(
    { user_id: userId, stripe_session_id: session.id, plan: plan.id, credits: plan.sessions, amount_cents: plan.priceCents, status: "paid", paid_at: new Date().toISOString() },
    { onConflict: "stripe_session_id", ignoreDuplicates: true },
  );
  return true;
}

/** Rinnovo pagato: ricarica le sessioni del mese (una volta per fattura). */
export async function renewFromInvoice(invoice: {
  id: string;
  billing_reason?: string;
  amount_paid?: number;
  subscription?: string | null;
  parent?: { subscription_details?: { subscription?: string } };
}): Promise<void> {
  if (invoice.billing_reason !== "subscription_cycle") return; // il primo pagamento lo gestisce il checkout
  const subId = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
  if (!subId) return;
  const { data: acc } = await db().from("accounts").select("user_id, plan").eq("stripe_subscription_id", subId).maybeSingle();
  const plan = findPlan(acc?.plan);
  if (!acc || !plan) return;
  // una fattura = una ricarica (la tabella acquisti fa da registro)
  const { data: inserted } = await db()
    .from("purchases")
    .upsert(
      { user_id: acc.user_id, stripe_session_id: invoice.id, plan: plan.id, credits: plan.sessions, amount_cents: invoice.amount_paid ?? plan.priceCents, status: "paid", paid_at: new Date().toISOString() },
      { onConflict: "stripe_session_id", ignoreDuplicates: true },
    )
    .select("id");
  if (!inserted?.length) return;
  const sub = await getSubscription(subId);
  await db()
    .from("accounts")
    .update({ plan_sessions_left: plan.sessions, plan_status: sub.status, plan_period_end: periodEnd(sub) })
    .eq("user_id", acc.user_id);
}

/** Cambio di stato dell'abbonamento (pagamento fallito, disdetta, fine). */
export async function syncSubscription(sub: {
  id: string;
  status: string;
  current_period_end?: number;
  metadata?: Record<string, string>;
  items?: { data: { current_period_end?: number }[] };
}): Promise<void> {
  const ended = sub.status === "canceled" || sub.status === "unpaid" || sub.status === "incomplete_expired";
  const plan = findPlan(sub.metadata?.plan);
  await db()
    .from("accounts")
    .update(
      ended
        ? { plan: "free", plan_status: sub.status, plan_sessions_left: 0, stripe_subscription_id: null }
        : { plan_status: sub.status, plan_period_end: periodEnd(sub as Parameters<typeof periodEnd>[0]), ...(plan ? { plan: plan.id } : {}) },
    )
    .eq("stripe_subscription_id", sub.id);
}

/**
 * Cambio di piano da Yeppo. Le sessioni del mese seguono il nuovo piano:
 * passando a uno più grande ricevi subito la differenza, a uno più piccolo restano al massimo quelle del nuovo piano.
 */
export async function changePlan(userId: string, newPlanId: string): Promise<{ plan: string; sessionsLeft: number }> {
  const next = findPlan(newPlanId);
  const { data: acc } = await db()
    .from("accounts")
    .select("plan, plan_status, plan_sessions_left, stripe_subscription_id")
    .eq("user_id", userId)
    .single();
  const current = findPlan(acc?.plan);
  if (!next || !acc?.stripe_subscription_id || !current) throw new UserError("Non hai un abbonamento attivo da cambiare.");
  if (current.id === next.id) throw new UserError("È già il tuo piano.");
  if (acc.plan_status !== "active" && acc.plan_status !== "trialing") {
    throw new UserError("Prima aggiorna il metodo di pagamento da «Gestisci abbonamento».");
  }
  const sub = await changeSubscriptionPlan(acc.stripe_subscription_id, next);
  const left = acc.plan_sessions_left ?? 0;
  const sessionsLeft = next.sessions > current.sessions ? left + (next.sessions - current.sessions) : Math.min(left, next.sessions);
  const { error } = await db()
    .from("accounts")
    .update({ plan: next.id, plan_sessions_left: sessionsLeft, plan_status: sub.status, plan_period_end: periodEnd(sub) })
    .eq("user_id", userId);
  if (error) throw error;
  return { plan: next.id, sessionsLeft };
}
