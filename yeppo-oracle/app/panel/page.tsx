import type { Metadata } from "next";
import CoinPanel from "@/components/CoinPanel";
import HotOnX from "@/components/HotOnX";
import { isMint } from "@/lib/format";

export const metadata: Metadata = { title: "yeppo", robots: { index: false } };

type P = { searchParams: Promise<{ mint?: string; key?: string; dev?: string }> };

export default async function Page({ searchParams }: P) {
  const q = await searchParams;
  const m = q.mint ?? "";
  const key = q.key && /^YEP-[0-9A-F]{5}(-[0-9A-F]{5}){3}$/.test(q.key) ? q.key : null;
  const dev = q.dev && /^[0-9a-f-]{36}$/.test(q.dev) ? q.dev : null;
  return (
    <main className="panel-page">
      {isMint(m) ? (
        <CoinPanel mint={m} compact pkey={key} pdev={dev} />
      ) : (
        <div className="cp">
          <div className="cp-empty" style={{ padding: "14px 0 4px" }}>
            <b>Open a coin</b>
            On pump.fun, Axiom, GMGN or DexScreener: yeppo reads it here.
          </div>
          <HotOnX pkey={key} pdev={dev} />
        </div>
      )}
    </main>
  );
}
