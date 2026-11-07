import Link from "next/link";
import JsonLd from "./JsonLd";
import { DB_HEADERS } from "@/lib/access";
import { SITE_URL, SUPABASE_URL } from "@/lib/config";
import Nav, { Footer } from "./Nav";
import Search from "./Search";
import Scope from "./Scope";
import Explode from "./Explode";
import { CHECKS } from "@/lib/checks";
import { Clock, Odo, PostLoop, RadarLoop } from "./Bits2";

// The home as an instrument, not a landing page: a faceplate with the radar scope reading coins, the week's real
// numbers on rolling counters and the real calls on a tape; then one read taken apart on scroll; then the radar and
// the X feed side by side as working examples; then price, guides and questions packed in one block.

/** [mint, ticker, call, × after the call, called at] (yr_wins_s, kept 10 min) */
type Win = [string, string | null, string, number, number];
async function wins(): Promise<Win[]> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_wins_s`, { method: "POST", headers: DB_HEADERS, body: "{}", next: { revalidate: 600 } });
    if (!r.ok) return [];
    const v = (await r.json()) as Win[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// the week of 28 Oct to 4 Nov 2026, from yeppo's own tables (also in the Discord launch post)
const WEEK: [number, string][] = [
  [164673, "coins read in a week"],
  [12050, "bundled launches flagged"],
  [991, "rugs spotted"],
];

const ROWS: [string, string][] = [
  ["Check a pump.fun coin for a rug", "/learn/pump-fun-rug-checker"],
  ["Spot a bundled launch", "/learn/memecoin-bundle-checker"],
  ["Read a creator before you buy", "/learn/dev-wallet-checker"],
  ["Wallets that move together", "/learn/bubble-map-memecoin"],
  ["When momentum lies", "/learn/when-to-buy-memecoin"],
  ["GMGN, Axiom and pump.fun", "/learn/gmgn-axiom-pump-fun-extension"],
];

export default async function Home() {
  const won = await wins();
  return (
    <>
      <Nav />
      <section className="xz">
        <Scope full />
        <div className="xz-bar">
          <span className="x-k">Rug checker · pump.fun · Solana</span>
          <span className="xh-bar-r">
            <Clock />
            <span className="x-live">
              <i /> reading every launch
            </span>
          </span>
        </div>
        <h1 className="xz-h">
          <span className="xz-dim">
            Read the chain,
            <br />
            not the chart.
          </span>
          <span className="xz-lit" aria-hidden>
            Read the chain,
            <br />
            not the chart.
          </span>
        </h1>
        <div className="xz-deck">
          <p className="xz-sub">
            Open a coin on Axiom, GMGN or pump.fun. In about a second yeppo reads the launch bundle, the real holders, the creator and the money behind them:{" "}
            <b className="t-up">Safe</b>, <b className="t-mid">Risky</b> or <b className="t-down">Danger</b>.
          </p>
          <div className="xz-act">
            <Link href="/extension" className="btn btn-go btn-lg">
              Add to Chrome
            </Link>
            <div className="xh-try">
              <Search label="Read it" />
            </div>
          </div>
          <div className="xz-nums">
            {WEEK.map(([n, l]) => (
              <div key={l}>
                <Odo n={n} />
                <span>{l}</span>
              </div>
            ))}
            <div>
              <Odo n={CHECKS.length} />
              <span>checks on every coin</span>
            </div>
          </div>
        </div>
      </section>
      <section className="xt">
        {won.length > 0 && (
          <div className="x-tape" aria-label="Real calls from the last 7 days">
            <span className="x-tape-k">Real calls · 7 days</span>
            <div className="x-tape-run">
              {[0, 1].map((dup) => (
                <div key={dup} className="x-tape-set" aria-hidden={dup === 1}>
                  {won.map(([mint, sym, word, up]) => (
                    <a key={mint + dup} href={`/go/${mint}`} target="_blank" rel="noreferrer" tabIndex={dup ? -1 : undefined}>
                      <b>{sym ? `$${sym.replace(/^\$/, "")}` : "coin"}</b>
                      <span>{word}</span>
                      <em>×{up.toFixed(1)}</em>
                    </a>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <Explode />

      <main className="wrap">
        <section className="xs xs-two">
          <div className="xs-cell">
            <span className="x-k">Wallet radar</span>
            <h2>Your wallets buy. yeppo reads the coin.</h2>
            <p>
              Paste the wallet list Axiom exports. The moment one of them buys, the coin is read against your rule. Two in within fifteen minutes, none out, every line passing and a Safe read: an early call.
            </p>
            <RadarLoop />
            <div className="xs-foot">
              <Link href="/radar" className="x-link">
                Open the radar <i>→</i>
              </Link>
              <small>example</small>
            </div>
          </div>
          <div className="xs-cell">
            <span className="x-k">Hot on X</span>
            <h2>A post lands. The coins born after it, read.</h2>
            <p>
              Connect your J7 feed. yeppo keeps the posts that matter, wires each one to the coins launched after it, drops the bad ones and puts first the coins your own wallets are buying.
            </p>
            <PostLoop />
            <div className="xs-foot">
              <Link href="/extension" className="x-link">
                In the panel <i>→</i>
              </Link>
              <small>example</small>
            </div>
          </div>
        </section>

        <section className="xs xs-three">
          <div className="xs-cell">
            <span className="x-k">Price</span>
            <h2>One key, paid in SOL.</h2>
            <p>Three devices, no account, no email. It never touches your wallet.</p>
            <div className="x-price">
              <Link href="/pricing">
                <span>30 days</span>
                <b>0.2 SOL</b>
                <i>→</i>
              </Link>
              <Link href="/pricing">
                <span>90 days</span>
                <b>0.5 SOL</b>
                <i>→</i>
              </Link>
            </div>
          </div>
          <div className="xs-cell">
            <span className="x-k">Guides</span>
            <ol className="x-guides">
              {ROWS.map(([t, h], i) => (
                <li key={h}>
                  <Link href={h}>
                    <i>{String(i + 1).padStart(2, "0")}</i>
                    {t}
                    <em aria-hidden>↗</em>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
          <div className="xs-cell" id="faq">
            <span className="x-k">Questions</span>
            <div className="x-faq">
              {FAQ.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "yeppo",
            applicationCategory: "FinanceApplication",
            operatingSystem: "Chrome, Brave, Edge, Arc",
            url: SITE_URL,
            description:
              "Chrome extension and site that checks any Solana memecoin on pump.fun, GMGN and Axiom: rug checks, launch bundles, the creator's past coins, the money behind the creator, and one verdict: Safe, Risky or Danger.",
            featureList: ["Pump.fun rug checker", "Dev wallet history", "Bundle checker", "Wallet radar", "Same-amount buy detection", "Safe, Risky or Danger verdict"],
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
          },
        ]}
      />
    </>
  );
}

const FAQ: [string, string][] = [
  ["What is yeppo?", "A Chrome extension and site that reads any Solana memecoin in one second: safety checks, snipers and big holders, the creator's past coins, the money behind the creator, the big wallets, summed up in one verdict: Safe, Risky or Danger."],
  ["How does yeppo check if a coin is a rug?", "It checks the top holders, the creator's share, linked insider wallets, the launch bundle, mint and freeze authority and locked liquidity, and compares the creator's earlier coins: how many ran, faded or were dumped in seconds."],
  ["Which sites does it work on?", "pump.fun, GMGN, Axiom, Photon, BullX, DexScreener, Birdeye, Solscan and Jupiter, in Chrome, Brave, Edge and Arc."],
  ["Does yeppo touch my wallet?", "No. It only reads the coin address on the page. It never sees your wallet, keys or passwords and cannot trade."],
  ["How much does it cost?", "A Pro key paid in SOL, no account and no card. See the pricing page for the plans."],
  ["Will it make me money?", "No tool can promise that. Most memecoins go to zero. yeppo removes the coins with known red flags and tells you when buyers are coming in; the trade is yours."],
];
