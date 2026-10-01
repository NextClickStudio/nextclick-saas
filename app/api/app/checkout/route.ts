// Crea il pagamento Stripe per un piano e restituisce il link alla pagina di pagamento.
import { z } from "zod";
import { handle, readBody } from "@/lib/api";
import { SITE_URL } from "@/lib/config";
import { db, UserError } from "@/lib/db";
import { findPlan } from "@/lib/plans";
import { createCheckout } from "@/lib/stripe";
import { requireUser } from "@/lib/supabase-auth";

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const { plan: planId } = await readBody(request, z.object({ plan: z.string() }));
    const plan = findPlan(planId);
    if (!plan) throw new UserError("Piano non valido.");

    const session = await createCheckout({
      userId: user.id,
      email: user.email,
      planId: plan.id,
      planName: plan.name,
      amountCents: plan.priceCents,
      credits: plan.credits,
      successUrl: `${SITE_URL}/app/piani?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${SITE_URL}/app/piani?annullato=1`,
    });
    const { error } = await db().from("purchases").insert({
      user_id: user.id,
      stripe_session_id: session.id,
      plan: plan.id,
      credits: plan.credits,
      amount_cents: plan.priceCents,
    });
    if (error) throw error;
    return { url: session.url };
  });
}
