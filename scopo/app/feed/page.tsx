import { redirect } from "next/navigation";
import { DEFAULT_LANG, isLangCode, scanHref } from "@/lib/languages";

type Props = { searchParams: Promise<{ t?: string | string[]; lang?: string | string[] }> };

/** Vecchi link al feed libero: ora ogni argomento diventa un percorso. */
export default async function FeedRedirect({ searchParams }: Props) {
  const { t, lang } = await searchParams;
  const topic = (Array.isArray(t) ? t[0] : t ?? "").trim().slice(0, 80);
  const l = Array.isArray(lang) ? lang[0] : lang;
  redirect(topic ? scanHref(topic, isLangCode(l) ? l : DEFAULT_LANG) : "/learn");
}
