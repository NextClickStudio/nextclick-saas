import Link from "next/link";
import JsonLd from "./JsonLd";
import { DB_HEADERS } from "@/lib/access";
import { SITE_URL, SUPABASE_URL } from "@/lib/config";
import { CHECKS } from "@/lib/checks";
import { Paper } from "./Nav";
import Search from "./Search";
import { Odo } from "./Bits2";
import Films from "./bw/Films";
import { Kinetic, Reveal } from "./bw/Motion";

// The home (8 Nov 2026), black and white: one headline, then the films that show how yeppo works (read a coin, the
// wallet radar, Hot on X, the install), then what it reads, the three verdicts, the week in numbers and the real calls,
// the price and the questions. Motion is choreographed in the films; the page itself only rises and draws rules.

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

// the week of 28 Oct to 4 Nov 2026, from yeppo's own tables
const WEEK: [number, string][] = [
  [164673, "coins read in a week"],
  [12050, "bundled launches flagged"],
  [991, "rugs spotted"],
  [CHECKS.length, "checks on every coin"],
];
const VERDICTS: { w: string; c: string; head: string; lines: string[] }[] = [
  { w: "Safe", c: "safe", head: "Nothing wrong found.", lines: ["Every safety check passes", "Insiders under 20%, on real balances", "No big wallet selling", "Creator and their money are clean"] },
  { w: "Risky", c: "risky", head: "Something to watch in who holds it.", lines: ["Insiders between 20% and 35%", "One wallet holds a large share", "A big holder is selling now", "Everything else passes"] },
  { w: "Danger", c: "danger", head: "A red flag.", lines: ["A failed safety check", "A creator who dumps their coins", "A hidden or large launch bundle", "Already dumped from its high"] },
];
const GUIDES: [string, string][] = [
  ["Check a pump.fun coin for a rug", "/learn/pump-fun-rug-checker"],
  ["Spot a bundled launch", "/learn/memecoin-bundle-checker"],
  ["Read a creator before you buy", "/learn/dev-wallet-checker"],
  ["Wallets that move together", "/learn/bubble-map-memecoin"],
  ["When momentum lies", "/learn/when-to-buy-memecoin"],
];
const utc = (t: number) => new Date(t).toISOString().slice(5, 16).replace("T", " ").replace("-", "/");

export default async function Home() {
  const won = await wins();
  return (
    <Paper className="bw home">
      <section className="b-hero">
        <Kinetic lines={["Know the coin", "before you buy it."]} className="b-h1" />
        <div className="b-hero-r">
          <Reveal delay={0.5}>
            <p className="b-lead">
              A Chrome extension for pump.fun, GMGN and Axiom. Open a coin: yeppo reads it from the chain in about a second — the launch bundle, who really
              holds it, the creator and the money behind them — and gives you one word.
            </p>
          </Reveal>
          <Reveal delay={0.65} className="b-act">
            <Link href="/extension" className="b-btn">
              Add to Chrome
            </Link>
            <div className="b-try">
              <Search label="Read" />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="b-films" id="how">
        <Films />
      </section>

      <section className="b-sec">
        <Reveal className="b-head">
          <span className="b-k">What it reads</span>
          <h2 className="b-h2">{CHECKS.length} checks, every coin.</h2>
        </Reveal>
        <Reveal className="b-checks" delay={0.1}>
          {CHECKS.map(([n, , src], i) => (
            <div key={n} style={{ ["--i" as string]: i }}>
              <i>{String(i + 1).padStart(2, "0")}</i>
              <span>{n}</span>
              <em>{src}</em>
            </div>
          ))}
        </Reveal>
      </section>

      <section className="b-sec">
        <Reveal className="b-head">
          <span className="b-k">The verdict</span>
          <h2 className="b-h2">One word, and the rule behind it.</h2>
        </Reveal>
        <div className="b-verdicts">
          {VERDICTS.map((v, i) => (
            <Reveal key={v.w} delay={0.08 * i} className="b-verdict">
              <b className={`b-vw b-${v.c}`}>
                <i />
                {v.w}
              </b>
              <h3>{v.head}</h3>
              <ul>
                {v.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="b-sec">
        <Reveal className="b-head">
          <span className="b-k">On the record</span>
          <h2 className="b-h2">The week, in numbers.</h2>
        </Reveal>
        <Reveal className="b-figs" delay={0.1}>
          {WEEK.map(([n, l]) => (
            <div key={l}>
              <Odo n={n} />
              <span>{l}</span>
            </div>
          ))}
        </Reveal>
        <Reveal className="b-calls" delay={0.15}>
          <span className="b-k">Real calls, last 7 days</span>
          {won.length ? (
            <table>
              <tbody>
                {won.slice(0, 6).map(([mint, sym, word, up, t]) => (
                  <tr key={mint}>
                    <td>
                      <b>{sym ? `$${sym.replace(/^\$/, "")}` : "coin"}</b>
                    </td>
                    <td>{word}</td>
                    <td className="mono">{utc(t)} UTC</td>
                    <td className="mono r">×{up.toFixed(1)}</td>
                    <td className="r">
                      <a href={`/go/${mint}`} target="_blank" rel="noreferrer">
                        Open ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="b-dim">The first calls of the week show up here within a few hours.</p>
          )}
          <p className="b-dim">
            Highest price after the call, against the price at the call. Every call, good and bad, is on the <Link href="/record">record</Link>.
          </p>
        </Reveal>
      </section>

      <section className="b-sec b-back">
        <Reveal className="b-price">
          <span className="b-k">Price</span>
          <h2 className="b-h2">One key, paid in SOL.</h2>
          <div className="b-plans">
            <Link href="/pricing">
              <span>30 days</span>
              <b>0.2 SOL</b>
            </Link>
            <Link href="/pricing">
              <span>90 days</span>
              <b>0.5 SOL</b>
            </Link>
          </div>
          <p className="b-dim">Three devices. No account, no email, no card. It never touches your wallet.</p>
        </Reveal>
        <Reveal className="b-faq" delay={0.1}>
          <span className="b-k" id="faq">
            Questions
          </span>
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
          <span className="b-k" style={{ marginTop: 28 }}>
            Guides
          </span>
          {GUIDES.map(([t, h]) => (
            <Link key={h} href={h} className="b-guide">
              {t}
              <em aria-hidden>→</em>
            </Link>
          ))}
        </Reveal>
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
