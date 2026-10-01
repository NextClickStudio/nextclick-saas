// Webhook Stripe: quando un pagamento va a buon fine, accredita le sessioni (una sola volta).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhook } from "@/lib/stripe";

export async function POST(request: Request) {
  const payload = await request.text();
  if (!verifyWebhook(payload, request.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "firma non valida" }, { status: 400 });
  }
  const event = JSON.parse(payload) as { type: string; data: { object: { id: string; payment_status?: string } } };
  if (
    (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") &&
    event.data.object.payment_status === "paid"
  ) {
    const { error } = await db().rpc("complete_purchase", { p_stripe_session: event.data.object.id });
    if (error) {
      console.error("Webhook: accredito non riuscito", error);
      return NextResponse.json({ error: "retry" }, { status: 500 });
    }
  }
  return NextResponse.json({ received: true });
}
