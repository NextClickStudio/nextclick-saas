import { PackOpener } from "@/components/PackOpener";
import { GAME_CONFIG } from "@/config/game";
import { requireHouse, todayUtc } from "@/lib/game/data";

export default async function PackPage({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  const { house } = await requireHouse();
  const { first } = await searchParams;
  return (
    <PackOpener
      freeReady={house.last_pack_day !== todayUtc()}
      credits={house.credits}
      price={GAME_CONFIG.shop.extraPackCredits}
      streak={house.streak}
      firstPack={first === "1"}
    />
  );
}
