import type { Metadata } from "next";
import Match from "@/components/Match";

export const metadata: Metadata = { title: "In match · yeppo royale" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Match id={id} />;
}
