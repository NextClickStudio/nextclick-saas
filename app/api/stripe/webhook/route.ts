// Webhook Stripe: abbonamenti (attivazione, rinnovo, disdetta) e sessioni extra (una sola volta per pagamento).
import { NextResponse } from "next/server";
import { activateFromCheckout, renewFromInvoice, syncSubscription } from "@/lib/billing";
import { db } from "@/lib/db";
import { verifyWebhook, type CheckoutSession } from "@/lib/stripe";

export async function POST(request: Request) {
  const payload = await request.text();
  if (!verifyWebhook(payload, request.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "firma non valida" }, { status: 400 });
  }
  const event = JSON.parse(payload) as { type: string; data: { object: Record<string, unknown> } };
  const obj = event.data.object;
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = obj as unknown as CheckoutSession;
        if (session.mode === "subscription") {
          await activateFromCheckout(session);
        } else if (session.payment_status === "paid") {
          const { error } = await db().rpc("complete_purchase", { p_stripe_session: session.id });
          if (error) throw error;
        }
        break;
      }
      case "invoice.paid":
        await renewFromInvoice(obj as Parameters<typeof renewFromInvoice>[0]);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(obj as Parameters<typeof syncSubscription>[0]);
        break;
    }
  } catch (err) {
    console.error(`Webhook ${event.type} non elaborato`, err);
    return NextResponse.json({ error: "retry" }, { status: 500 }); // Stripe riprova da solo
  }
  return NextResponse.json({ received: true });
}
