import type { Metadata } from "next";
import PanelView from "@/components/PanelView";
import { isMint } from "@/lib/format";

export const metadata: Metadata = { title: "yeppo", robots: { index: false } };

type P = { searchParams: Promise<{ mint?: string }> };

export default async function Page({ searchParams }: P) {
  const m = (await searchParams).mint ?? "";
  return <PanelView mint={isMint(m) ? m : null} />;
}
