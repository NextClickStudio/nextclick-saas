import Link from "next/link";
import JsonLd from "./JsonLd";
import { DB_HEADERS } from "@/lib/access";
import { SITE_URL, SUPABASE_URL } from "@/lib/config";
import { CHECKS } from "@/lib/checks";
import { Paper } from "./Nav";
import Search from "./Search";
import CaseFile from "./CaseFile";
import Explode from "./Explode";
import Stamps from "./Stamps";
import { Odo, PostLoop, RadarLoop } from "./Bits2";

// The home as a printed report (7 Nov 2026): every coin gets a case file. A masthead, the file on the desk, the week's
// figures and the real calls set as a ledger, one read taken apart, the three stamps and their rules, the radar and the
// X feed as working examples, then the back matter (price, guides, questions).

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
const WEEK: [number, string, string][] = [
  [164673, "coins read", "every pump.fun launch, from its first block"],
  [12050, "bundled launches flagged", "a group of wallets buying in the launch block"],
  [991, "rugs spotted", "creators who dumped in seconds"],
];

const ROWS: [string, string][] = [
  ["Check a pump.fun coin for a rug", "/learn/pump-fun-rug-checker"],
  ["Spot a bundled launch", "/learn/memecoin-bundle-checker"],
  ["Read a creator before you buy", "/learn/dev-wallet-checker"],
  ["Wallets that move together", "/learn/bubble-map-memecoin"],
  ["When momentum lies", "/learn/when-to-buy-memecoin"],
  ["GMGN, Axiom and pump.fun", "/learn/gmgn-axiom-pump-fun-extension"],
];

const utc = (t: number) => new Date(t).toISOString().slice(5, 16).replace("T", " ").replace("-", "/");

export default async function Home() {
  const won = await wins();
  return (
    <Paper className="home">
      <section className="h-hero">
        <div className="h-copy">
          <p className="p-kick">Rug checks for pump.fun, GMGN and Axiom</p>
          <h1 className="h-h1">
            Every coin
            <br />
            gets a file.
          </h1>
          <p className="h-sub">
            Open a coin and yeppo reads it from the chain in about a second: the launch bundle, the real holders, the creator and the money behind them.
            Then it stamps it <b className="t-safe">Safe</b>, <b className="t-risky">Risky</b> or <b className="t-danger">Danger</b>.
          </p>
          <div className="h-act">
            <Link href="/extension" className="p-btn p-btn-lg">
              Add to Chrome
            </Link>
            <div className="h-try">
              <Search label="Open the file" />
            </div>
          </div>
          <p className="h-note">Works beside the chart on Axiom, GMGN and pump.fun. It never touches your wallet.</p>
        </div>
        <CaseFile />
      </section>

      <section className="h-ledger">
        <div className="h-figs">
          <p className="p-sec">
            <i>§1</i> The week on file
          </p>
          {WEEK.map(([n, l, note]) => (
            <div key={l} className="h-fig">
              <Odo n={n} />
              <b>{l}</b>
              <span>{note}</span>
            </div>
          ))}
          <div className="h-fig">
            <Odo n={CHECKS.length} />
            <b>checks on every coin</b>
            <span>from the chain, RugCheck and X</span>
          </div>
          <p className="h-src">28 Oct to 4 Nov 2026, from yeppo&apos;s own tables.</p>
        </div>
        <div className="h-wins">
          <p className="p-sec">
            <i>§2</i> Real calls, last 7 days
          </p>
          {won.length ? (
            <table className="p-table">
              <thead>
                <tr>
                  <th>Coin</th>
                  <th>Stamp</th>
                  <th>Filed (UTC)</th>
                  <th className="r">Then</th>
                  <th aria-label="Open on Axiom" />
                </tr>
              </thead>
              <tbody>
                {won.slice(0, 8).map(([mint, sym, word, up, t]) => (
                  <tr key={mint}>
                    <td>
                      <b>{sym ? `$${sym.replace(/^\$/, "")}` : "coin"}</b>
                    </td>
                    <td>{word}</td>
                    <td className="mono">{utc(t)}</td>
                    <td className="r mono t-safe">×{up.toFixed(1)}</td>
                    <td className="r">
                      <a href={`/go/${mint}`} target="_blank" rel="noreferrer" aria-label={`Open ${sym ?? "the coin"} on Axiom`}>
                        Axiom ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="h-empty">The first calls of the week show up here within a few hours.</p>
          )}
          <p className="h-src">
            Highest price after the call, against the price at the call. Every call, good and bad, is on the <Link href="/record">record</Link>.
          </p>
        </div>
      </section>

      <Explode />

      <section className="h-sec" id="stamps">
        <p className="p-sec">
          <i>§4</i> Three verdicts, written rules
        </p>
        <h2 className="h-h2">One word, and why.</h2>
        <Stamps />
      </section>

      <section className="h-sec h-two">
        <div>
          <p className="p-sec">
            <i>§5</i> Wallet radar
          </p>
          <h2 className="h-h2">Your wallets buy. yeppo opens the file.</h2>
          <p className="h-p">
            Paste the wallet list Axiom exports. The moment one of them buys, the coin is read against your rule. Two in within fifteen minutes, none out,
            every line passing and a Safe stamp: an early call.
          </p>
          <RadarLoop />
          <p className="h-foot">
            <Link href="/radar">Open the radar →</Link>
            <span>example</span>
          </p>
        </div>
        <div>
          <p className="p-sec">
            <i>§6</i> Hot on X
          </p>
          <h2 className="h-h2">A post lands. The coins born after it, read.</h2>
          <p className="h-p">
            Connect your J7 feed. yeppo keeps the posts that matter, ties each one to the coins launched after it, drops the bad ones and puts first the
            coins your own wallets are buying.
          </p>
          <PostLoop />
          <p className="h-foot">
            <Link href="/extension">In the panel →</Link>
            <span>example</span>
          </p>
        </div>
      </section>

      <section className="h-sec h-back">
        <div>
          <p className="p-sec">
            <i>§7</i> Price
          </p>
          <div className="p-invoice">
            <div className="p-inv-row">
              <span>Pro key, 30 days</span>
              <i />
              <b>0.2 SOL</b>
            </div>
            <div className="p-inv-row">
              <span>Pro key, 90 days</span>
              <i />
              <b>0.5 SOL</b>
            </div>
            <p>Three devices. No account, no email, no card.</p>
            <Link href="/pricing" className="p-btn">
              Get a key
            </Link>
          </div>
        </div>
        <div>
          <p className="p-sec">
            <i>§8</i> Guides
          </p>
          <ol className="p-index">
            {ROWS.map(([t, h], i) => (
              <li key={h}>
                <Link href={h}>
                  <i>{String(i + 1).padStart(2, "0")}</i>
                  <span>{t}</span>
                  <em aria-hidden>↗</em>
                </Link>
              </li>
            ))}
          </ol>
        </div>
        <div id="faq">
          <p className="p-sec">
            <i>§9</i> Questions
          </p>
          <div className="p-faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
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
    </Paper>
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
