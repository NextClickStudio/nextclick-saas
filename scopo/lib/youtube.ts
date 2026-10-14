import type { Video } from "./types.ts";
import { decodeEntities, parseIsoDuration } from "./text.ts";

const API = "https://www.googleapis.com/youtube/v3";

/** Gli Shorts durano al massimo 3 minuti. */
export const MAX_SHORT_SECONDS = 180;
const MIN_SECONDS = 8;

export type Candidate = Video & { description: string };

export type SearchPage = {
  candidates: Candidate[];
  nextPageToken: string | null;
};

type SearchListResponse = {
  nextPageToken?: string;
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      description?: string;
      channelTitle?: string;
      liveBroadcastContent?: string;
      thumbnails?: Record<string, { url?: string }>;
    };
  }>;
};

type VideosListResponse = {
  items?: Array<{ id: string; contentDetails?: { duration?: string } }>;
};

export class YouTubeError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function getJson<T>(url: URL): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    let reason = `${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) reason = body.error.message;
    } catch {
      // corpo non JSON: teniamo lo status
    }
    throw new YouTubeError(`YouTube API: ${reason}`, res.status);
  }
  return (await res.json()) as T;
}

/**
 * Una ricerca costa 100 unità di quota (10.000 al giorno gratis), il dettaglio
 * delle durate 1 unità. Teniamo solo video brevi, incorporabili e non in diretta.
 */
export async function searchShorts(
  apiKey: string,
  query: string,
  pageToken?: string,
): Promise<SearchPage> {
  const search = new URL(`${API}/search`);
  search.search = new URLSearchParams({
    part: "snippet",
    type: "video",
    q: query,
    maxResults: "25",
    videoDuration: "short",
    videoEmbeddable: "true",
    relevanceLanguage: "it",
    regionCode: "IT",
    safeSearch: "moderate",
    key: apiKey,
    ...(pageToken ? { pageToken } : {}),
  }).toString();

  const data = await getJson<SearchListResponse>(search);
  const raw = (data.items ?? []).filter(
    (it) => it.id?.videoId && (it.snippet?.liveBroadcastContent ?? "none") === "none",
  );
  if (raw.length === 0) return { candidates: [], nextPageToken: data.nextPageToken ?? null };

  const details = new URL(`${API}/videos`);
  details.search = new URLSearchParams({
    part: "contentDetails",
    id: raw.map((it) => it.id!.videoId!).join(","),
    key: apiKey,
  }).toString();
  const durations = new Map(
    ((await getJson<VideosListResponse>(details)).items ?? []).map((v) => [
      v.id,
      parseIsoDuration(v.contentDetails?.duration ?? ""),
    ]),
  );

  const candidates: Candidate[] = [];
  for (const it of raw) {
    const id = it.id!.videoId!;
    const durationSec = durations.get(id) ?? 0;
    if (durationSec < MIN_SECONDS || durationSec > MAX_SHORT_SECONDS) continue;
    const s = it.snippet ?? {};
    candidates.push({
      id,
      title: decodeEntities(s.title ?? ""),
      channel: decodeEntities(s.channelTitle ?? ""),
      description: decodeEntities(s.description ?? "").slice(0, 220),
      thumbnail:
        s.thumbnails?.high?.url ?? s.thumbnails?.medium?.url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      durationSec,
    });
  }
  return { candidates, nextPageToken: data.nextPageToken ?? null };
}
