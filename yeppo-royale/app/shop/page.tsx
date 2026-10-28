import type { Metadata } from "next";
import Shop from "@/components/Shop";

export const metadata: Metadata = { title: "Shop · yeppo royale" };

export default function Page() {
  return <Shop />;
}
