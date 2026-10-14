import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Feed } from "@/components/Feed";
import { DEFAULT_LANG, isLangCode, type LangCode } from "@/lib/languages";

type Props = { searchParams: Promise<{ t?: string | string[]; lang?: string | string[] }> };

async function readParams(searchParams: Props["searchParams"]): Promise<{ topic: string; lang: LangCode }> {
  const { t, lang } = await searchParams;
  const topic = (Array.isArray(t) ? t[0] : t ?? "").trim().slice(0, 80);
  const l = Array.isArray(lang) ? lang[0] : lang;
  return { topic, lang: isLangCode(l) ? l : DEFAULT_LANG };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { topic } = await readParams(searchParams);
  return { title: topic || "Feed" };
}

export default async function FeedPage({ searchParams }: Props) {
  const { topic, lang } = await readParams(searchParams);
  if (!topic) redirect("/learn");
  // key: changing topic or language starts a fresh feed.
  return <Feed key={`${topic}|${lang}`} topic={topic} lang={lang} />;
}
