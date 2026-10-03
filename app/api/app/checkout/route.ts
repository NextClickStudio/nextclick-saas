// Pagamento Stripe: abbonamento a un piano oppure sessione extra. Restituisce il link alla pagina di pagamento.
import { z } from "zod";
import { handle, readBody } from "@/lib/api";
import { SITE_URL } from "@/lib/config";
import { db, UserError } from "@/lib/db";
import { EXTRA_SESSION, findPlan, planActive } from "@/lib/plans";
import { createCheckout, createSubscriptionCheckout } from "@/lib/stripe";
import { getAccount, requireUser } from "@/lib/supabase-auth";

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const { plan: planId } = await readBody(request, z.object({ plan: z.string() }));
    const account = await getAccount(user.id);
    const urls = {
      successUrl: `${SITE_URL}/app/piani?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${SITE_URL}/app/piani?annullato=1`,
    };

    if (planId === "extra") {
      const session = await createCheckout({
        userId: user.id,
        email: user.email,
        customerId: account.stripe_customer_id,
        planId: "extra",
        planName: "Yeppo – sessione extra (30 aziende)",
        amountCents: EXTRA_SESSION.priceCents,
        credits: EXTRA_SESSION.sessions,
        ...urls,
      });
      const { error } = await db().from("purchases").insert({
        user_id: user.id,
        stripe_session_id: session.id,
        plan: "extra",
        credits: EXTRA_SESSION.sessions,
        amount_cents: EXTRA_SESSION.priceCents,
      });
      if (error) throw error;
      return { url: session.url };
    }

    const plan = findPlan(planId);
    if (!plan) throw new UserError("Piano non valido.");
    if (planActive(account.plan_status) && account.stripe_subscription_id) {
      throw new UserError("Hai già un abbonamento attivo: per cambiarlo o disdirlo usa «Gestisci abbonamento».");
    }
    const session = await createSubscriptionCheckout({
      userId: user.id,
      email: user.email,
      customerId: account.stripe_customer_id,
      planId: plan.id,
      planName: plan.name,
      amountCents: plan.priceCents,
      ...urls,
    });
    return { url: session.url };
  });
}
