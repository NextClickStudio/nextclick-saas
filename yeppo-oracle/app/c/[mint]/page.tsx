import type { Metadata } from "next";
import Link from "next/link";
import CoinPanel from "@/components/CoinPanel";
import Nav, { Footer } from "@/components/Nav";
import Search from "@/components/Search";
import { isMint, short } from "@/lib/format";

type P = { params: Promise<{ mint: string }>; searchParams: Promise<{ mini?: string; panel?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { mint } = await params;
  return { title: `${short(decodeURIComponent(mint))} · yeppo` };
}

export default async function Page({ params, searchParams }: P) {
  const mint = decodeURIComponent((await params).mint);
  const q = await searchParams;
  // extension 1.0 opens its card at /c/<mint>?mini=1&panel=1: give it today's panel
  if (q.mini === "1" && isMint(mint))
    return (
      <main className="panel-page">
        <CoinPanel mint={mint} compact />
      </main>
    );
  return (
    <>
      <Nav />
      <main className="wrap">
        {!isMint(mint) ? (
          <div className="page">
            <div className="page-head">
              <h1>That&apos;s not a coin address.</h1>
              <p>Paste the coin&apos;s address, or a link from pump.fun, GMGN or DexScreener.</p>
            </div>
            <div className="coin-search">
              <Search autoFocus />
            </div>
            <p style={{ marginTop: 18 }}>
              <Link href="/" className="mute">
                ← Home
              </Link>
            </p>
          </div>
        ) : (
          <div className="coin-page">
            <div className="card" style={{ padding: 14 }}>
              <CoinPanel mint={mint} />
            </div>
            <div>
              <span className="label">Read another coin</span>
              <div className="coin-search" style={{ marginTop: 10 }}>
                <Search />
              </div>
              <div className="card" style={{ padding: 18, marginTop: 18 }}>
                <span className="label">How to read it</span>
                <ul className="cre-list" style={{ marginTop: 12 }}>
                  <li>
                    <span>
                      <b>Momentum</b>: safe, and buyers are in right now. Short trades only.
                    </span>
                  </li>
                  <li>
                    <span>
                      <b>Wait</b>: nothing wrong, no push. Wait for volume.
                    </span>
                  </li>
                  <li>
                    <span>
                      <b>Don&apos;t buy</b>: a trap, a rugger, or already dumped.
                    </span>
                  </li>
                  <li>
                    <span>
                      <b>Pink lines</b>: the creator&apos;s earlier coins. Where they drop is where the creator sells.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
