import type { Metadata } from "next";
import BotView from "@/components/BotView";

type Props = { params: Promise<{ ticker: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  return { title: `$${ticker.toUpperCase()}` };
}

export default async function BotPage({ params }: Props) {
  const { ticker } = await params;
  return <BotView ticker={ticker.toUpperCase()} />;
}
