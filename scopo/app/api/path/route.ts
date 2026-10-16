import { buildPlan } from "@/lib/curriculum";
import { DEFAULT_LANG, isLangCode } from "@/lib/languages";
import { isLevel } from "@/lib/paths";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST { topic, lang, level, known } → il percorso ordinato e da dove partire. */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 80) : "";
  if (!topic) return Response.json({ error: "Type something you want to learn." }, { status: 400 });

  const lang = isLangCode(body.lang) ? body.lang : DEFAULT_LANG;
  const level = isLevel(body.level) ? body.level : "new";
  const known = typeof body.known === "string" ? body.known.slice(0, 500) : "";

  try {
    return Response.json(await buildPlan({ topic, lang, level, known }));
  } catch (err) {
    console.error(err);
    return Response.json({ error: "We couldn't build your path. Please try again." }, { status: 500 });
  }
}
