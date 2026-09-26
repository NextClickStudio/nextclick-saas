import { BottomNav } from "@/components/BottomNav";
import { requireHouse, todayUtc } from "@/lib/game/data";

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const { house } = await requireHouse();
  return (
    <>
      <div className="pb-28">{children}</div>
      <BottomNav packReady={house.last_pack_day !== todayUtc()} />
    </>
  );
}
