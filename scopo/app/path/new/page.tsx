import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ScanFlow } from "@/components/ScanFlow";
import { DEFAULT_LANG, isLangCode } from "@/lib/languages";

export const metadata: Metadata = { title: "New path" };

type Props = { searchParams: Promise<{ t?: string | string[]; lang?: string | string[] }> };

export default async function NewPathPage({ searchParams }: Props) {
  const { t, lang } = await searchParams;
  const topic = (Array.isArray(t) ? t[0] : t ?? "").trim().slice(0, 80);
  const l = Array.isArray(lang) ? lang[0] : lang;
  if (!topic) redirect("/learn");
  return <ScanFlow key={`${topic}|${l}`} topic={topic} lang={isLangCode(l) ? l : DEFAULT_LANG} />;
}
