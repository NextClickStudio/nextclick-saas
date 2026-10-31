import type { Metadata } from "next";
import Shop from "@/components/Shop";

export const metadata: Metadata = { title: "Shop · yeppo 1v1" };

export default function Page() {
  return <Shop />;
}
