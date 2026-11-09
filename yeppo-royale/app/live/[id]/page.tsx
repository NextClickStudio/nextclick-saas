import type { Metadata } from "next";
import LiveDuel from "@/components/LiveDuel";

export const metadata: Metadata = {
  title: "Live duel · yeppo 1v1",
  description: "3 minutes, 10 play SOL, any live pump.fun coin. Biggest bag wins.",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveDuel id={id} />;
}
