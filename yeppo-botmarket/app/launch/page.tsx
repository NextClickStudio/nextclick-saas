import type { Metadata } from "next";
import Launch from "@/components/Launch";

export const metadata: Metadata = { title: "Launch a bot" };

export default function LaunchPage() {
  return <Launch />;
}
