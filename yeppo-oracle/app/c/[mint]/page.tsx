import type { Metadata } from "next";
import Link from "next/link";
import Scan from "@/components/Scan";
import { isMint, short } from "@/lib/format";

type P = { params: Promise<{ mint: string }>; searchParams: Promise<{ mini?: string; panel?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { mint } = await params;
  return { title: `Oracle scan ${short(decodeURIComponent(mint))} · yeppo` };
}

export default async function Page({ params, searchParams }: P) {
  const mint = decodeURIComponent((await params).mint);
  const q = await searchParams;
  const mini = q.mini === "1";
  if (!isMint(mint))
    return (
      <main className="wrap" style={{ padding: "80px 0", textAlign: "center" }}>
        <h1 className="disp">That is not a coin address</h1>
        <p className="dim">Paste the coin&apos;s contract address (CA), for example from pump.fun or GMGN.</p>
        <Link className="btn btn-glow" href="/">
          Back to the oracle
        </Link>
      </main>
    );
  return <Scan mint={mint} mini={mini} panel={mini && q.panel === "1"} />;
}
