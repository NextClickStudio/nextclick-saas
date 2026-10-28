import type { Metadata } from "next";
import Leaderboard from "@/components/Leaderboard";

export const metadata: Metadata = { title: "Leaderboard · yeppo royale" };

export default function Page() {
  return <Leaderboard />;
}
