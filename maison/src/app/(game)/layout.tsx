"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Splash } from "@/components/Splash";
import { TrendSheet } from "@/components/TrendSheet";
import { useGame } from "@/lib/game/store";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  const { status, state, market } = useGame();
  const router = useRouter();

  useEffect(() => {
    if (status === "signed-out") router.replace("/");
    if (status === "no-house") router.replace("/onboarding");
  }, [status, router]);

  if (!state || !market) return <Splash />;
  return (
    <>
      <div className="pb-28">{children}</div>
      <BottomNav />
      <TrendSheet />
    </>
  );
}
