import type { Metadata } from "next";
import RealHub from "@/components/RealHub";

export const metadata: Metadata = { title: "Real duels · yeppo 1v1", description: "1v1 trading duels with your own wallet, verified on-chain. Highest ROI wins." };

export default function Page() {
  return <RealHub />;
}
