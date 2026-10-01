// Genera sintomo visibile + criteri con l'AI (passo 2 della nuova sessione e "Rigenera").
import { z } from "zod";
import { generateSymptomAndCriteria } from "@/lib/ai";
import { handle, readBody } from "@/lib/api";
import { requireUser } from "@/lib/supabase-auth";

export const maxDuration = 60;

const schema = z.object({
  product_description: z.string().trim().min(10, "Descrivi meglio cosa vendi (almeno 10 caratteri).").max(2000),
  target_customer: z.string().trim().min(3, "Indica a chi lo vendi.").max(1000),
  target_sector: z.string().trim().min(3, "Indica il settore delle aziende target.").max(300),
});

export async function POST(request: Request) {
  return handle(async () => {
    await requireUser();
    const input = await readBody(request, schema);
    return generateSymptomAndCriteria({
      productDescription: input.product_description,
      targetCustomer: input.target_customer,
      targetSector: input.target_sector,
    });
  });
}
