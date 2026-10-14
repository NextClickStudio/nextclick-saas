import type { NextRequest } from "next/server";
import { demoFeed, liveFeed } from "@/lib/feed";
import { DEFAULT_LANG, isLangCode } from "@/lib/languages";
import type { FeedResponse } from "@/lib/types";
import { YouTubeError } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const topic = (params.get("topic") ?? "").trim().slice(0, 80);
  if (!topic) {
    return Response.json({ error: "Type something you want to learn." }, { status: 400 });
  }
  const rawLang = params.get("lang");
  const lang = isLangCode(rawLang) ? rawLang : DEFAULT_LANG;

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return Response.json(demoFeed(topic, lang));
  }

  try {
    const page = await liveFeed(apiKey, topic, lang, params.get("cursor") ?? undefined);
    const body: FeedResponse = { topic, lang, mode: "live", ...page };
    return Response.json(body);
  } catch (err) {
    if (err instanceof YouTubeError) {
      console.error(err.message);
      const quota = err.status === 403 && /quota/i.test(err.message);
      return Response.json(
        {
          error: quota
            ? "We've hit today's free YouTube search limit. Please try again tomorrow."
            : "YouTube isn't responding right now. Please try again in a moment.",
        },
        { status: 502 },
      );
    }
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
