export type Video = {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationSec?: number;
  /** One line on what you learn from this video (from AI curation or the demo set). */
  reason?: string;
};
