import { fetchStepVideos } from "@/lib/feed";
import { DEFAULT_LANG, isLangCode } from "@/lib/languages";
import { YouTubeError } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST { topic, step, queries, lang, cursor? } → i video di un passo del percorso. */
export async function POST(req: Request) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Video search isn't switched on in this demo yet." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 80) : "";
  const step = typeof body.step === "string" ? body.step.trim().slice(0, 80) : "";
  const queries = Array.isArray(body.queries)
    ? body.queries.filter((q): q is string => typeof q === "string" && q.trim().length > 0).map((q) => q.trim().slice(0, 100)).slice(0, 3)
    : [];
  if (!topic || queries.length === 0) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const lang = isLangCode(body.lang) ? body.lang : DEFAULT_LANG;
  const cursor = typeof body.cursor === "string" ? body.cursor : undefined;

  try {
    return Response.json(await fetchStepVideos(apiKey, { topic, step, queries, lang, cursor }));
  } catch (err) {
    if (err instanceof YouTubeError) {
      console.error(err.message);
      const quota = err.status === 403 && /quota/i.test(err.message);
      return Response.json(
        {
          error: quota
            ? "We've hit today's free YouTube search limit. Your progress is saved, so try again tomorrow."
            : "YouTube isn't responding right now. Please try again in a moment.",
        },
        { status: 502 },
      );
    }
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
