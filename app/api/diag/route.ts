// TEMPORANEO: verifica della chiave Gemini e della ricerca persone. Da rimuovere dopo il test.
import { findPeopleOnWeb, generateOutreach } from "@/lib/ai";

export const maxDuration = 90;

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("t") !== "39d2262a1164efabf8b11eca56cf024a") return new Response("Not found", { status: 404 });
  const out: Record<string, unknown> = {};
  const t0 = Date.now();
  try {
    out.people = await findPeopleOnWeb({ companyName: "Velasca", website: "https://www.velasca.com", sector: "scarpe e moda uomo" });
  } catch (e) {
    out.peopleError = (e as Error).message;
  }
  out.peopleSeconds = (Date.now() - t0) / 1000;
  try {
    const m = await generateOutreach({ companyName: "Velasca", sector: "moda", productDescription: "test", senderName: "Carlo", senderCompany: "", senderRole: "", senderWebsite: "", senderOffer: "test", bookingUrl: "", reportUrl: "https://yeppo.it/r/test", position: 5, total: 30, score: 60, weakPoints: [{ title: "Poche recensioni", explanation: "Le schede prodotto mostrano poche recensioni." }], openingAngle: "", channels: ["whatsapp"], step: 0, previous: [] });
    out.message = m[0]?.body;
  } catch (e) {
    out.messageError = (e as Error).message;
  }
  return Response.json(out);
}
