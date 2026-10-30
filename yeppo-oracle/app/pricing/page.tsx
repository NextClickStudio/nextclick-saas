import type { Metadata } from "next";
import Pricing from "@/components/Pricing";

export const metadata: Metadata = { title: "Pricing · yeppo", description: "One plan, paid in SOL from any Solana wallet. No account, no card." };

export default function Page() {
  return <Pricing />;
}
