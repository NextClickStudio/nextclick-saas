import type { LangCode } from "./languages.ts";

export type Video = {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationSec?: number;
  /** One line on what you learn from this video (from AI curation or the demo set). */
  reason?: string;
};

export type FeedMode = "live" | "demo";

export type FeedResponse = {
  topic: string;
  lang: LangCode;
  mode: FeedMode;
  items: Video[];
  /** Send back to get the next page; null = no more results. */
  cursor: string | null;
  notice?: string;
  suggestions?: Array<{ topic: string; lang: LangCode }>;
};
