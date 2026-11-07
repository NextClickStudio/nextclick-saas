import Link from "next/link";
import JsonLd from "./JsonLd";
import { SITE_URL } from "@/lib/config";
import CameraStory from "./CameraStory";
import Chrome3D from "./Chrome3D";
import Nav, { Footer } from "./Nav";
import Search from "./Search";

// The home, built like a product page and not like a landing template: a chrome wordmark with the facts beside it,
// the camera story through one read, the full list of checks under one big number, the radar and the X feed in the
// product's own words, the guides as plain rows, the price, the FAQ.

const SPEC = ["Every pump.fun launch, read live", "Launch bundle read from the chain", "Real balances, not seen trades", "164,673 coins read last week", "Open now"];

const CHECKS = [
  "Launch bundle", "Insiders on real balances", "Snipers", "Silent early group", "Big wallets", "Linked wallets", "Same-amount buys",
  "Fresh holder wallets", "Top 10 holders", "Creator's past coins", "Serial launcher", "Creator's funder", "Rug network behind the funder",
  "Mint authority", "Freeze authority", "Liquidity locked", "Hidden bundle", "Ticker copies", "X origin", "Recycled X account",
  "Buyers against sellers", "Odds of a 2x", "Top traders in", "Holders selling now",
];

const ROWS: [string, string][] = [
  ["Check a pump.fun coin for a rug", "/learn/pump-fun-rug-checker"],
  ["Spot a bundled launch", "/learn/memecoin-bundle-checker"],
  ["Read a creator before you buy", "/learn/dev-wallet-checker"],
  ["Wallets that move together", "/learn/bubble-map-memecoin"],
  ["When momentum lies", "/learn/when-to-buy-memecoin"],
  ["Use it on GMGN, Axiom and pump.fun", "/learn/gmgn-axiom-pump-fun-extension"],
];

export default function Home() {
  return (
    <>
      <Nav />
      <section className="hz">
        <div className="hz-top">
          <span className="hz-k">Rug checker · pump.fun</span>
          <ul className="hz-spec">
            {SPEC.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <Chrome3D />
        <div className="hz-bot">
          <h1>The rug checker that reads the chain.</h1>
          <div className="hz-act">
            <Link href="/extension" className="btn btn-go btn-lg">
              Add to Chrome
            </Link>
            <div className="hz-try">
              <Search label="Read it" />
            </div>
          </div>
        </div>
      </section>

      <CameraStory />

      <main className="wrap">
        <section className="ns" id="how">
          <span className="ns-k">Every check</span>
          <div className="ns-split">
            <div>
              <b className="ns-big">{CHECKS.length}</b>
              <h2 className="ns-h">checks, on every coin you open.</h2>
              <p className="ns-p">One second, one word: Safe, Risky or Danger. Each number comes from the chain or from RugCheck, and when two sources disagree yeppo says so instead of calling the coin clean.</p>
            </div>
            <ul className="ns-grid">
              {CHECKS.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="ns">
          <span className="ns-k">Wallet radar</span>
          <div className="ns-split">
            <div>
              <h2 className="ns-h2">Your wallets, followed.</h2>
              <p className="ns-p">Paste the list Axiom exports. The moment one of your wallets buys, yeppo reads the coin. Two in within fifteen minutes, none out, every check of your rule passing and a Safe read: that is an early call. yeppo also finds wallets worth copying on its own, ready to export back to Axiom.</p>
              <Link href="/radar" className="btn btn-lg btn-ghost">
                Open the radar
              </Link>
            </div>
            <div className="ns-list">
              {[
                ["$SEAL", "2 of your wallets · 4 min", "Early call", "up"],
                ["$BOOK", "a lead wallet is out", "Risky", "mid"],
                ["$GOAT", "bundle 38%", "Danger", "down"],
              ].map(([s, l, w, t]) => (
                <div key={s} className="ns-row">
                  <b>{s}</b>
                  <span>{l}</span>
                  <em className={t}>{w}</em>
                </div>
              ))}
              <small>example</small>
            </div>
          </div>
        </section>

        <section className="ns">
          <span className="ns-k">Hot on X</span>
          <div className="ns-split">
            <div>
              <h2 className="ns-h2">A post, the coins born after it, your wallets in them.</h2>
              <p className="ns-p">Connect your J7 feed. yeppo keeps only the posts that matter, shows the coins launched after each one, keeps the Safe ones and puts first the ones your wallets are buying. The words several posts share become the narratives, with the headlines behind them.</p>
            </div>
            <div className="ns-list">
              {[
                ["@a large account", "posted 2 min ago"],
                ["$WHALE", "born after it · 2 of your wallets in · Safe"],
                ["whale", "4 posts · 23 coins born · 3 Safe"],
              ].map(([a, b]) => (
                <div key={a} className="ns-row">
                  <b>{a}</b>
                  <span>{b}</span>
                </div>
              ))}
              <small>example</small>
            </div>
          </div>
        </section>

        <section className="ns">
          <span className="ns-k">Guides</span>
          <div className="ns-rows">
            {ROWS.map(([t, h]) => (
              <Link key={h} href={h} className="ns-link">
                {t}
                <i aria-hidden>↗</i>
              </Link>
            ))}
          </div>
        </section>

        <section className="ns">
          <span className="ns-k">Price</span>
          <div className="ns-split">
            <div>
              <h2 className="ns-h2">One key. Paid in SOL.</h2>
              <p className="ns-p">Three devices, no account, no email. It never touches your wallet.</p>
            </div>
            <div className="ns-price">
              <Link href="/pricing">
                <span>30 days</span>
                <b>0.2 SOL</b>
              </Link>
              <Link href="/pricing">
                <span>90 days</span>
                <b>0.5 SOL</b>
              </Link>
            </div>
          </div>
        </section>

        <section className="ns" id="faq">
          <span className="ns-k">Questions</span>
          <div className="faq-list">
            {FAQ.map(([q, a]) => (
              <details key={q} className="faq">
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
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
