import type { Metadata } from "next";
import { PathPlayer } from "@/components/PathPlayer";

export const metadata: Metadata = { title: "Learning" };

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PathPlayer key={id} id={id} />;
}
