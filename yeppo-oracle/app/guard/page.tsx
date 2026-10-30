import type { Metadata } from "next";
import Guard from "@/components/Guard";

export const metadata: Metadata = { title: "Bag Guard · yeppo", description: "yeppo watches your pump.fun bags and tells you when to get out." };

export default function Page() {
  return <Guard />;
}
