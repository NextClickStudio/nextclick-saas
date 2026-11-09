import type { Metadata } from "next";
import RealDuel from "@/components/RealDuel";

export const metadata: Metadata = {
  title: "Real duel challenge · yeppo 1v1",
  description: "My wallet vs yours. A real 1v1 memecoin trading duel, verified on-chain. Highest ROI wins.",
};

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RealDuel code={code} />;
}
