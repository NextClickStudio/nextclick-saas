// Apre il portale clienti di Stripe (carta, fatture, disdetta dell'abbonamento).
import { handle } from "@/lib/api";
import { SITE_URL } from "@/lib/config";
import { UserError } from "@/lib/db";
import { createPortal } from "@/lib/stripe";
import { getAccount, requireUser } from "@/lib/supabase-auth";

export async function POST() {
  return handle(async () => {
    const user = await requireUser();
    const account = await getAccount(user.id);
    if (!account.stripe_customer_id) throw new UserError("Non hai ancora un abbonamento.");
    return createPortal(account.stripe_customer_id, `${SITE_URL}/app/piani`);
  });
}
