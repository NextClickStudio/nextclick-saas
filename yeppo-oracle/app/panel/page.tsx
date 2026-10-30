import type { Metadata } from "next";
import CoinPanel from "@/components/CoinPanel";
import { isMint } from "@/lib/format";

export const metadata: Metadata = { title: "yeppo", robots: { index: false } };

type P = { searchParams: Promise<{ mint?: string }> };

export default async function Page({ searchParams }: P) {
  const m = (await searchParams).mint ?? "";
  return (
    <main className="panel-page">
      {isMint(m) ? (
        <CoinPanel mint={m} compact />
      ) : (
        <div className="cp-empty">
          <b>Open a coin</b>
          On pump.fun, GMGN, Axiom or DexScreener. yeppo reads it here.
        </div>
      )}
    </main>
  );
}
