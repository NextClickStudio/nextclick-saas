import { CardsGrid } from "@/components/CardsGrid";
import { loadMyCards, requireHouse } from "@/lib/game/data";

export default async function CardsPage() {
  const { supabase, user } = await requireHouse();
  const { views } = await loadMyCards(supabase, user.id);
  const { data: closed } = await supabase
    .from("maison_cards")
    .select("id, trend_id, rarity, status, closed_at, closed_for, maison_trends(name)")
    .eq("user_id", user.id)
    .neq("status", "active")
    .order("closed_at", { ascending: false })
    .limit(20);
  const history = (closed ?? []).map((c) => ({
    id: c.id as string,
    name: ((c.maison_trends as unknown as { name: string } | null)?.name ?? c.trend_id) as string,
    rarity: c.rarity as string,
    status: c.status as string,
    closedFor: (c.closed_for ?? 0) as number,
    closedAt: c.closed_at as string,
  }));
  return <CardsGrid cards={views} history={history} />;
}
