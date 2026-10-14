import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Feed } from "@/components/Feed";

type Props = { searchParams: Promise<{ t?: string | string[] }> };

async function readTopic(searchParams: Props["searchParams"]): Promise<string> {
  const { t } = await searchParams;
  return (Array.isArray(t) ? t[0] : t ?? "").trim().slice(0, 80);
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const topic = await readTopic(searchParams);
  return { title: topic ? `${topic} · Scopo` : "Scopo" };
}

export default async function FeedPage({ searchParams }: Props) {
  const topic = await readTopic(searchParams);
  if (!topic) redirect("/");
  // key: cambiando argomento il feed riparte da zero.
  return <Feed key={topic} topic={topic} />;
}
