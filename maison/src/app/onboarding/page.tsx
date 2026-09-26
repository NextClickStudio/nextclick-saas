"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { OnboardingForm } from "@/components/OnboardingForm";
import { Splash } from "@/components/Splash";
import { useGame } from "@/lib/game/store";

export default function OnboardingPage() {
  const { status, userName } = useGame();
  const router = useRouter();
  useEffect(() => {
    if (status === "signed-out") router.replace("/");
    if (status === "ready") router.replace("/today");
  }, [status, router]);
  if (status !== "no-house") return <Splash />;
  return <OnboardingForm firstName={userName} />;
}
