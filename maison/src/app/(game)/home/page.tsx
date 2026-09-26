import Link from "next/link";
import { HomeDashboard } from "@/components/HomeDashboard";
import { GAME_CONFIG } from "@/config/game";
import { cardNumbers } from "@/lib/cards/view";
import { loadMyCards, loadTrends, requireHouse, todayUtc } from "@/lib/game/data";

export default async function HomePage() {
  const { supabase, user, house } = await requireHouse();
  const { views } = await loadMyCards(supabase, user.id);

  // Maison value = credits + everything you hold, marked to market.
  const perPoint = (r: keyof typeof GAME_CONFIG.rarityMultiplier) => GAME_CONFIG.rarityMultiplier[r] * GAME_CONFIG.market.creditsPerPoint;
  const worth = house.credits + views.reduce((s, v) => s + cardNumbers(v).worth, 0);
  const worthOpen = house.credits + views.reduce((s, v) => s + Math.round(v.dayOpen * perPoint(v.rarity)), 0);
  const len = Math.max(0, ...views.map((v) => v.history.length));
  const series = Array.from({ length: len }, (_, d) =>
    views.reduce((s, v) => {
      const h = v.history;
      const i = d - (len - h.length);
      return s + (i >= 0 ? h[i] : h[0]) * perPoint(v.rarity);
    }, house.credits),
  );
  if (series.length) series[series.length - 1] = worth;

  // Today's duel
  const today = todayUtc();
  const { data: duel } = await supabase
    .from("maison_duels")
    .select("*")
    .eq("day", today)
    .or(`a.eq.${user.id},b.eq.${user.id}`)
    .maybeSingle();
  let duelView = null;
  if (duel) {
    const meA = duel.a === user.id;
    const oppId = meA ? duel.b : duel.a;
    const [{ data: mine }, { data: theirs }, { data: opp }] = await Promise.all([
      supabase.rpc("maison_runway_score", { cards: meA ? duel.a_cards : duel.b_cards }),
      oppId ? supabase.rpc("maison_runway_score", { cards: meA ? duel.b_cards : duel.a_cards }) : Promise.resolve({ data: 0 }),
      oppId ? supabase.from("maison_houses").select("name, monogram, palette").eq("user_id", oppId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    duelView = { me: Number(mine ?? 0), them: Number(theirs ?? 0), opponent: opp?.name ?? "The market" };
  }

  // Notifications
  const { data: notes } = await supabase
    .from("maison_notifications")
    .select("id, kind, body, created_at")
    .eq("user_id", user.id)
    .eq("read", false)
    .order("id", { ascending: false })
    .limit(5);

  // Market movers
  const trends = await loadTrends(supabase);
  const moves = trends.map((t) => ({ id: t.id, name: t.name, family: t.family, change: t.day_open ? t.value / t.day_open - 1 : 0 })).sort((a, b) => b.change - a.change);

  return (
    <HomeDashboard
      house={house}
      worth={worth}
      dayChange={worthOpen ? worth / worthOpen - 1 : 0}
      series={series}
      runway={views.filter((v) => v.onRunway)}
      cardsCount={views.length}
      packReady={house.last_pack_day !== today}
      duel={duelView}
      notes={notes ?? []}
      movers={[...moves.slice(0, 3), ...moves.slice(-3).reverse()]}
      admin={Boolean((await supabase.rpc("maison_is_admin")).data)}
      footer={
        <Link href="/lab" className="text-sm text-muted underline-offset-4 hover:underline">
          Card lab
        </Link>
      }
    />
  );
}
