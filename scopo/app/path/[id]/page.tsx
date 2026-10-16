import type { Metadata } from "next";
import { PathOverview } from "@/components/PathOverview";

export const metadata: Metadata = { title: "Your path" };

export default async function PathPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PathOverview id={id} />;
}
