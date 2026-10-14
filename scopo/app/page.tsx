import { Home } from "@/components/Home";
import { aiEnabled } from "@/lib/curator";
import { SEED_TOPICS } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Home
      liveSearch={Boolean(process.env.YOUTUBE_API_KEY)}
      aiCuration={aiEnabled()}
      demoTopics={SEED_TOPICS.map(({ label, emoji }) => ({ label, emoji }))}
    />
  );
}
