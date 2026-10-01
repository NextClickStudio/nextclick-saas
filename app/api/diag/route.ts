// TEMPORANEO: verifica della chiave Gemini e della ricerca persone. Da rimuovere dopo il test.
import { GoogleGenAI } from "@google/genai";
import { findPeopleOnWeb } from "@/lib/ai";

export const maxDuration = 60;

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  if (q.get("t") !== "39d2262a1164efabf8b11eca56cf024a") return new Response("Not found", { status: 404 });
  if (q.get("people")) {
    const t1 = Date.now();
    const steps: Record<string, unknown>[] = [];
    const run = findPeopleOnWeb({ companyName: q.get("people")!, website: q.get("site") || "", sector: q.get("sector") || "" }, (i) =>
      steps.push({ ...i, s: (Date.now() - t1) / 1000 }),
    ).then((people) => ({ people }), (e: Error) => ({ error: e.message }));
    // risposta entro 50 s anche se la ricerca è lenta, con i passi fatti finora
    const result = await Promise.race([run, new Promise((r) => setTimeout(() => r({ timeout: true }), 50_000))]);
    return Response.json({ s: (Date.now() - t1) / 1000, result, steps });
  }
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const model = q.get("model") || "gemini-3.5-flash";
  const search = q.get("search") === "1";
  const t0 = Date.now();
  try {
    const r = await ai.models.generateContent({
      model,
      contents: search ? "Chi sono i fondatori e il responsabile marketing di Velasca (scarpe, velasca.com)? Nomi e ruoli, una riga." : "Rispondi solo: ok",
      config: { ...(search ? { tools: [{ googleSearch: {} }] } : {}), httpOptions: { timeout: 40_000 } },
    });
    return Response.json({ ok: true, model, search, s: (Date.now() - t0) / 1000, sources: r.candidates?.[0]?.groundingMetadata?.groundingChunks?.length ?? 0, text: (r.text ?? "").slice(0, 400) });
  } catch (e) {
    return Response.json({ ok: false, model, search, s: (Date.now() - t0) / 1000, status: (e as { status?: number }).status, error: String((e as Error).message).slice(0, 300) });
  }
}
