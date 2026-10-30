import type { Metadata } from "next";
import Lab from "@/components/Lab";

export const metadata: Metadata = { title: "Lab · yeppo", robots: { index: false, follow: false } };

export default function Page() {
  return <Lab />;
}
