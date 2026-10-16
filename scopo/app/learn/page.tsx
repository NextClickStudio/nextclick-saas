import type { Metadata } from "next";
import { LearnHome } from "@/components/LearnHome";
import { seedSuggestions } from "@/lib/seed";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Learn",
};

export default function LearnPage() {
  return (
    <LearnHome
      liveSearch={Boolean(process.env.YOUTUBE_API_KEY)}
      demoTiles={seedSuggestions().map(({ topic, emoji, lang }) => ({ topic, emoji, lang }))}
    />
  );
}
