import type { Metadata } from "next";
import Arena from "@/components/arena/Arena";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `Arena #${code.toUpperCase()} — yeppo` };
}

export default async function RoomPage({ params }: Props) {
  const { code } = await params;
  return <Arena code={code.toUpperCase()} />;
}
