import type { Metadata } from "next";
import Link from "next/link";
import CoinPanel from "@/components/CoinPanel";
import { Paper } from "@/components/Nav";
import Search from "@/components/Search";
import { redirect } from "next/navigation";
import { isMint, short } from "@/lib/format";

/** Axiom, Photon and DexScreener links carry the pool, not the coin: the coin a pool trades, from DexScreener (kept 10
 *  min). Coins that end in "pump" are pump.fun coins already and skip the question. */
async function coinOfPool(addr: string): Promise<string | null> {
  if (/pump$/.test(addr)) return null;
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${addr}`, { next: { revalidate: 600 }, signal: AbortSignal.timeout(2500) });
    const j = (await r.json()) as { pairs?: { baseToken?: { address?: string }; quoteToken?: { address?: string } }[] | null };
    const p = j.pairs?.[0];
    const QUOTE = ["So11111111111111111111111111111111111111112", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"];
    const base = p?.baseToken?.address;
    const coin = base && QUOTE.includes(base) ? p?.quoteToken?.address : base;
    return coin && coin !== addr && isMint(coin) ? coin : null;
  } catch {
    return null;
  }
}

type P = { params: Promise<{ mint: string }>; searchParams: Promise<{ mini?: string; panel?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { mint } = await params;
  return { title: `${short(decodeURIComponent(mint))} · yeppo` };
}

export default async function Page({ params, searchParams }: P) {
  const mint = decodeURIComponent((await params).mint);
  const q = await searchParams;
  // a pool's address (pasted from Axiom, Photon or DexScreener): open the coin it trades
  if (isMint(mint)) {
    const coin = await coinOfPool(mint);
    if (coin) redirect(`/c/${coin}${q.mini === "1" ? "?mini=1&panel=1" : ""}`);
  }
  // extension 1.0 opens its card at /c/<mint>?mini=1&panel=1: give it today's panel
  if (q.mini === "1" && isMint(mint))
    return (
      <main className="panel-page">
        <CoinPanel mint={mint} compact />
      </main>
    );
  return (
    <>
      <Paper>
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
            <div className="screen">
              <div className="p-screen-head">
                <span>
                  <i /> File · {short(mint)}
                </span>
                <a href={`/go/${mint}`} target="_blank" rel="noreferrer">
                  Open on Axiom ↗
                </a>
              </div>
              <div className="p-screen-body">
                <CoinPanel mint={mint} />
              </div>
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
                      <b>Safe</b>: nothing wrong found in the holders, the creator, the money behind them or the safety checks.
                    </span>
                  </li>
                  <li>
                    <span>
                      <b>Risky</b>: one thing to watch in who holds it: insiders 20%+, one big wallet, a big holder selling.
                    </span>
                  </li>
                  <li>
                    <span>
                      <b>Danger</b>: a red flag: a failed check, a rugger creator, a hidden bundle, or already dumped.
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
      </Paper>
    </>
  );
}
