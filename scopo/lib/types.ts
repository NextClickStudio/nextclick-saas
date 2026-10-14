export type Video = {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationSec?: number;
  /** Breve spiegazione del perché il video è nel feed (dalla curatela AI). */
  reason?: string;
};

export type FeedMode = "live" | "demo";

export type FeedResponse = {
  topic: string;
  mode: FeedMode;
  items: Video[];
  /** Da rimandare al server per la pagina successiva; null = fine dei risultati. */
  cursor: string | null;
  notice?: string;
  suggestions?: string[];
};
