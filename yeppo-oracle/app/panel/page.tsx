import type { Metadata } from "next";
import CoinPanel from "@/components/CoinPanel";
import { isMint } from "@/lib/format";

export const metadata: Metadata = { title: "yeppo", robots: { index: false } };

type P = { searchParams: Promise<{ mint?: string; paper?: string; key?: string; dev?: string }> };

export default async function Page({ searchParams }: P) {
  const q = await searchParams;
  const m = q.mint ?? "";
  // the extension hands over the paper wallet it keeps (an unguessable uuid)
  const paper = q.paper && /^[0-9a-f-]{36}$/.test(q.paper) ? q.paper : null;
  const key = q.key && /^YEP-[0-9A-F]{5}(-[0-9A-F]{5}){3}$/.test(q.key) ? q.key : null;
  const dev = q.dev && /^[0-9a-f-]{36}$/.test(q.dev) ? q.dev : null;
  return (
    <main className="panel-page">
      {isMint(m) ? (
        <CoinPanel mint={m} compact paper={paper} pkey={key} pdev={dev} />
      ) : (
        <div className="cp-empty">
          <b>Open a coin</b>
          On pump.fun, GMGN, Axiom or DexScreener. yeppo reads it here.
        </div>
      )}
    </main>
  );
}
