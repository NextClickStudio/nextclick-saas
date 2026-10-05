// Cambio del piano in abbonamento (superiore o inferiore), con differenza calcolata da Stripe.
import { z } from "zod";
import { handle, readBody } from "@/lib/api";
import { changePlan } from "@/lib/billing";
import { requireUser } from "@/lib/supabase-auth";

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const { plan } = await readBody(request, z.object({ plan: z.enum(["basic", "pro", "agency"]) }));
    return changePlan(user.id, plan);
  });
}
