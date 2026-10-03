// TEMPORANEO: prova del Radar solo social. Da rimuovere dopo il test.
import { searchRadarSignal } from "@/lib/radar";

export const maxDuration = 60;

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  if (q.get("t") !== "5154c4a27ab882c58d5179eda179aeb6") return new Response("Not found", { status: 404 });
  const t0 = Date.now();
  const signal = (q.get("s") || "richiesta") as "richiesta" | "lavoro" | "lancio";
  try {
    const items = await searchRadarSignal(
      signal,
      {
        sectors: ["e-commerce skincare e cosmetica", "brand beauty italiani", "farmacie online"],
        topics: ["clienti indecisi su quale prodotto scegliere", "consulenza skincare online", "quiz prodotto", "tasso di conversione e-commerce", "chatbot AI per e-commerce"],
        roles: ["founder", "marketing manager", "e-commerce manager"],
        platforms: [],
        country: "Italia",
      },
      "Sistema AI che crea una skincare routine personalizzata e consiglia i prodotti giusti dell'e-commerce",
    );
    return Response.json({ s: (Date.now() - t0) / 1000, items });
  } catch (e) {
    return Response.json({ s: (Date.now() - t0) / 1000, error: (e as Error).message });
  }
}
