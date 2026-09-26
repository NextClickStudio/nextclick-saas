"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Intro } from "@/components/Intro";
import { Splash } from "@/components/Splash";
import { trendCard, useGame, useListed } from "@/lib/game/store";

export default function Home() {
  const { status } = useGame();
  const listed = useListed();
  const router = useRouter();

  useEffect(() => {
    if (status === "ready") router.replace("/today");
    if (status === "no-house") router.replace("/onboarding");
  }, [status, router]);

  // Three live cards from different families, strongest movers first.
  const cards = useMemo(() => {
    const seen = new Set<string>();
    const rarities = ["rare", "legendary", "epic"] as const;
    return [...listed]
      .filter((t) => t.history.length > 5)
      .sort((a, b) => Math.abs(b.value / b.dayOpen - 1) - Math.abs(a.value / a.dayOpen - 1))
      .filter((t) => (seen.has(t.family) ? false : (seen.add(t.family), true)))
      .slice(0, 3)
      .map((t, i) => ({ ...trendCard(t), rarity: rarities[i] }));
  }, [listed]);

  if (status !== "signed-out") return <Splash />;
  return <Intro cards={cards} />;
}
