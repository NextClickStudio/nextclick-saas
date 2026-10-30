import type { Metadata } from "next";
import Guard from "@/components/Guard";

export const metadata: Metadata = { title: "Wallet · yeppo", description: "yeppo watches your memecoin bags, tells you when to get out and stops you when your day limit is hit." };

export default function Page() {
  return <Guard />;
}
