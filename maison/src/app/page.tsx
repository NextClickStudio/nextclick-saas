"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Intro } from "@/components/Intro";
import { Splash } from "@/components/Splash";
import { useLearn } from "@/lib/learn/store";

export default function Home() {
  const { status } = useLearn();
  const router = useRouter();

  useEffect(() => {
    if (status === "ready") router.replace("/learn");
    if (status === "no-house") router.replace("/onboarding");
  }, [status, router]);

  if (status !== "signed-out") return <Splash />;
  return <Intro />;
}
