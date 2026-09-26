import { MarketList } from "@/components/MarketList";
import { loadHistories, loadTrends, requireHouse } from "@/lib/game/data";

export default async function MarketPage() {
  const { supabase } = await requireHouse();
  const trends = await loadTrends(supabase);
  const histories = await loadHistories(supabase, trends);
  const rows = trends.map((t) => ({
    id: t.id,
    name: t.name,
    family: t.family,
    value: t.value,
    change: t.day_open ? t.value / t.day_open - 1 : 0,
    history: histories.get(t.id) ?? [t.value],
    live: t.source === "google" || t.source === "serpapi",
    updatedAt: t.updated_at,
  }));
  return <MarketList rows={rows} />;
}
