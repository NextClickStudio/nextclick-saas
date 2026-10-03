// TEMPORANEO: prova del motore Radar. Da rimuovere dopo il test.
import { scanRadar } from "@/lib/radar";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("t") !== "14c7bcb81d6574bf4bc88e26ed56fdbd") return new Response("Not found", { status: 404 });
  const t0 = Date.now();
  const steps: Record<string, unknown>[] = [];
  try {
    const items = await scanRadar(
      {
        profile: {
          sectors: ["e-commerce beauty e skincare", "brand cosmetici italiani", "farmacie online"],
          topics: ["consigliare il prodotto giusto ai clienti", "quiz prodotto", "conversioni e-commerce", "personalizzazione", "chatbot AI per e-commerce", "customer care che risponde a domande sui prodotti"],
          roles: ["founder", "CEO", "marketing manager", "e-commerce manager"],
          platforms: [],
          country: "Italia",
        },
        offer: "Sistema AI che crea una skincare routine personalizzata e consiglia i prodotti giusti dell'e-commerce",
        exclude: [],
      },
      (i) => steps.push({ ...i, s: (Date.now() - t0) / 1000 }),
    );
    return Response.json({ s: (Date.now() - t0) / 1000, items, steps });
  } catch (e) {
    return Response.json({ s: (Date.now() - t0) / 1000, error: (e as Error).message, steps });
  }
}
