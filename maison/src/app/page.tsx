import { redirect } from "next/navigation";
import { Intro } from "@/components/Intro";
import { loadHistories, loadTrends, trendView } from "@/lib/game/data";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: house } = await supabase.from("maison_houses").select("user_id").eq("user_id", user.id).maybeSingle();
    redirect(house ? "/home" : "/onboarding");
  }

  // Three live cards for the intro.
  const trends = (await loadTrends(supabase, ["mary-janes", "cobalt", "houndstooth"])).sort((a, b) => a.name.localeCompare(b.name));
  const histories = await loadHistories(supabase, trends);
  const rarities = ["rare", "legendary", "epic"] as const;
  const cards = trends.map((t, i) => trendView(t, histories.get(t.id) ?? [], rarities[i % 3]));

  return <Intro cards={cards} />;
}
