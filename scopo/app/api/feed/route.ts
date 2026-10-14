import type { NextRequest } from "next/server";
import { demoFeed, liveFeed } from "@/lib/feed";
import type { FeedResponse } from "@/lib/types";
import { YouTubeError } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const topic = (params.get("topic") ?? "").trim().slice(0, 80);
  if (!topic) {
    return Response.json({ error: "Scrivi un argomento." }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return Response.json(demoFeed(topic));
  }

  try {
    const page = await liveFeed(apiKey, topic, params.get("cursor") ?? undefined);
    const body: FeedResponse = { topic, mode: "live", ...page };
    return Response.json(body);
  } catch (err) {
    if (err instanceof YouTubeError) {
      console.error(err.message);
      const quota = err.status === 403 && /quota/i.test(err.message);
      return Response.json(
        {
          error: quota
            ? "Per oggi abbiamo finito le ricerche gratuite su YouTube. Riprova domani."
            : "YouTube non risponde in questo momento. Riprova tra poco.",
        },
        { status: 502 },
      );
    }
    console.error(err);
    return Response.json({ error: "Qualcosa è andato storto. Riprova." }, { status: 500 });
  }
}
