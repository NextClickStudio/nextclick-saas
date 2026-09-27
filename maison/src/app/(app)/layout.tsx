"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Player } from "@/components/learn/Player";
import { Splash } from "@/components/Splash";
import { useLearn } from "@/lib/learn/store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status, state } = useLearn();
  const router = useRouter();

  useEffect(() => {
    // A friend's duel link opened while signed out: remember it for after sign-in.
    const join = new URLSearchParams(location.search).get("join");
    if (join && status !== "ready") {
      try {
        localStorage.setItem("maison:join", join);
      } catch {
        /* ignore */
      }
    }
    if (status === "signed-out") router.replace("/");
    if (status === "no-house") router.replace("/onboarding");
    if (status === "ready") {
      let pending: string | null = null;
      try {
        pending = localStorage.getItem("maison:join");
        localStorage.removeItem("maison:join");
      } catch {
        /* ignore */
      }
      if (pending && !join) router.replace(`/duels?join=${pending}`);
    }
  }, [status, router]);

  if (!state) return <Splash />;
  return (
    <>
      <div className="pb-28">{children}</div>
      <BottomNav />
      <Player />
    </>
  );
}
