import Link from "next/link";
import JsonLd from "./JsonLd";
import { SITE_URL } from "@/lib/config";
import Demo from "./Demo";
import Nav, { Footer } from "./Nav";
import Reveal from "./Reveal";
import Search from "./Search";

const SITES = ["pump.fun", "GMGN", "Axiom", "Photon", "BullX", "DexScreener", "Birdeye", "Jupiter"];

export default function Home() {
  return (
    <>
      <Nav />
      <main className="wrap">
        <section className="hero">
          <div>
            <Reveal>
              <span className="kicker">
                <i className="live" /> Every pump.fun launch, live
              </span>
            </Reveal>
            <Reveal delay={80}>
              <h1>
                know who made it.
                <br />
                <span className="grad">catch the move.</span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="lead">Safety, creator, top traders and the exit. On any coin, in one second.</p>
            </Reveal>
            <Reveal delay={240} className="hero-cta">
              <Link href="/extension" className="btn btn-go btn-lg">
                Add to Chrome
              </Link>
              <a href="#how" className="btn btn-lg btn-ghost">
                How it works
              </a>
            </Reveal>
            <Reveal delay={320} className="hero-try">
              <Search label="Read it" />
            </Reveal>
          </div>
          <Reveal delay={200}>
            <Demo />
          </Reveal>
        </section>
      </main>

      <div className="marq" aria-label="Works on">
        <div className="marq-row">
          {[...SITES, ...SITES].map((s, i) => (
            <span key={i}>{s}</span>
          ))}
        </div>
      </div>

      <main className="wrap">
        <section className="sec" id="how">
          <Reveal className="sec-head">
            <span className="label">How it works</span>
            <h2>three reads. one second.</h2>
          </Reveal>
          <div className="three">
            <Reveal className="card feat" delay={0}>
              <div className="feat-art">
                <div className="art-checks">
                  {["Top 10 hold 14%", "Creator holds 0%", "No hidden bundle", "Liquidity locked"].map((t, i) => (
                    <div key={t} style={{ "--i": i } as React.CSSProperties}>
                      <i>✓</i>
                      {t}
                    </div>
                  ))}
                </div>
              </div>
              <span className="label feat-k">Safety</span>
              <h3>Is it a trap?</h3>
            </Reveal>
            <Reveal className="card feat" delay={90}>
              <div className="feat-art">
                <div className="art-kols">
                  {[
                    ["Cented", "12 SOL", "holding", "in"],
                    ["decu", "3.5 SOL", "sold", "out"],
                    ["milito", "2.1 SOL", "holding", "in"],
                  ].map(([n, v, st, c], i) => (
                    <div key={n} className={c} style={{ "--i": i } as React.CSSProperties}>
                      <i />
                      <b>{n}</b>
                      <span className="mono">{v}</span>
                      <span className="mono st">{st}</span>
                    </div>
                  ))}
                </div>
              </div>
              <span className="label feat-k" style={{ color: "var(--cyan)" }}>
                Top traders
              </span>
              <h3>Who&apos;s in, who&apos;s out?</h3>
            </Reveal>
            <Reveal className="card feat" delay={180}>
              <div className="feat-art">
                <div className="art-exit">
                  <span className="art-pill">
                    <i />
                    Safe
                  </span>
                  <span className="art-pill x">
                    <i />
                    Big wallet 11%
                  </span>
                </div>
              </div>
              <span className="label feat-k" style={{ color: "var(--down)" }}>
                Big wallets
              </span>
              <h3>Who could dump it?</h3>
            </Reveal>
          </div>
        </section>

        <section className="sec">
          <div className="cre">
            <Reveal>
              <span className="label" style={{ color: "var(--dev)" }}>
                Creator history
              </span>
              <div className="sec-head" style={{ margin: 0 }}>
                <h2>most rugs are reruns.</h2>
                <p>Same wallet, same dump. yeppo remembers every coin they launched.</p>
              </div>
            </Reveal>
            <Reveal delay={120} className="card cre-art glow-edge">
              <div className="cp">
                <section className="cp-call t-down">
                  <div className="cp-word">
                    <i />
                    Don&apos;t buy
                  </div>
                  <p>This creator rugged 6 of their last 7 coins.</p>
                </section>
                <div className="cp-coins">
                  {[
                    ["$MOONDOG", "2h", "×2.6", "dump −91%", "rug"],
                    ["$DOGMOON", "5h", "×2.2", "dump −88%", "rug"],
                    ["$PUPPER", "9h", "×1.4", "sold 2m", "dead"],
                    ["$WOOFY", "1d", "×3.0", "dump −93%", "rug"],
                    ["$BARK", "2d", "×2.4", "dump −90%", "rug"],
                  ].map(([s, a, p, so, f]) => (
                    <div key={s} className="cp-coin">
                      <span>
                        {s} <span className="when">{a} ago</span>
                      </span>
                      <span className="mono mute">{p}</span>
                      <span className="mono dim">{so}</span>
                      <span className={`chip tone fate fate-${f}`}>{f === "rug" ? "Rugged" : "Faded"}</span>
                    </div>
                  ))}
                </div>
                <p className="dim" style={{ margin: 0, fontSize: 11 }}>
                  Example
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="sec">
          <Reveal className="sec-head center">
            <span className="label">The verdict</span>
            <h2>three words. no noise.</h2>
          </Reveal>
          <div className="words">
            {[
              ["up", "Safe", "Nothing wrong found."],
              ["mid", "Risky", "Something to watch."],
              ["down", "Danger", "A trap. Walk away."],
            ].map(([t, w, p], i) => (
              <Reveal key={w} className={`card word t-${t}`} delay={i * 90}>
                <WordViz tone={t} />
                <b>
                  <i />
                  {w}
                </b>
                <p>{p}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="sec">
          <Reveal className="sec-head">
            <span className="label">Start</span>
            <h2>live in a minute.</h2>
          </Reveal>
          <div className="steps">
            <i className="steps-line" aria-hidden />
            {[
              ["Add to Chrome", "Chrome, Brave, Edge, Arc."],
              ["Open any coin", "pump.fun, Axiom, GMGN…"],
              ["Read the call", "Click the icon: it opens on the side."],
            ].map(([h, p], i) => (
              <Reveal key={h} className="card step" delay={i * 90}>
                <StepIcon n={i} />
                <span>0{i + 1}</span>
                <h3>{h}</h3>
                <p>{p}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="sec" id="faq">
          <Reveal className="sec-head">
            <span className="label">FAQ</span>
            <h2>the short answers.</h2>
          </Reveal>
          <div className="faq-list">
            {FAQ.map(([q, a]) => (
              <details key={q} className="faq card">
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
          <p className="mute small" style={{ marginTop: 14 }}>
            More in the guides: <Link href="/learn/pump-fun-rug-checker">how to check a pump.fun coin for a rug</Link>,{" "}
            <Link href="/learn/memecoin-bundle-checker">spotting bundles</Link>, <Link href="/learn/dev-wallet-checker">checking the dev wallet</Link>{" "}
            and <Link href="/learn/when-to-buy-memecoin">when momentum lies</Link>.
          </p>
        </section>

        <Reveal className="card final glow-edge">
          <h2>
            trade the move.
            <br />
            <span className="grad">skip the rug.</span>
          </h2>
          <p>One key, paid in SOL. It never touches your wallet.</p>
          <Link href="/extension" className="btn btn-go btn-lg">
            Add to Chrome
          </Link>
        </Reveal>
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
            featureList: ["Pump.fun rug checker", "Dev wallet history", "Bundle checker", "Bubble map of wallets that bought together", "Memecoin scanner", "Safe, Risky or Danger verdict"],
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

/** the little live chart on each of the three words: a run, a pause, a crash */
function WordViz({ tone }: { tone: string }) {
  const d =
    tone === "up"
      ? "M0 52 L22 48 L40 50 L58 38 L76 41 L96 26 L114 30 L136 14 L160 8"
      : tone === "mid"
        ? "M0 32 C20 22 30 42 50 32 S80 22 100 32 S130 42 160 32"
        : "M0 40 L24 34 L46 24 L66 14 L84 12 L92 52 L112 56 L136 54 L160 57";
  return (
    <div className="wviz" aria-hidden>
      <svg viewBox="0 0 160 64" preserveAspectRatio="none">
        <path className="wviz-fill" d={`${d} L160 64 L0 64 Z`} />
        <path className="wviz-line" pathLength={1} d={d} />
      </svg>
      <span className="wviz-dot" />
    </div>
  );
}

/** the three steps, each with a small looping animation */
function StepIcon({ n }: { n: number }) {
  return (
    <div className={`sicon sicon-${n}`} aria-hidden>
      {n === 0 && (
        <svg viewBox="0 0 24 24" width="26" height="26">
          <path d="M12 3v11m0 0-4.5-4.5M12 14l4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
      )}
      {n === 1 && (
        <>
          <span className="sicon-coin">$</span>
          <svg className="sicon-cursor" viewBox="0 0 24 24" width="18" height="18">
            <path d="M5 3l14 7-6 2-2 6z" />
          </svg>
        </>
      )}
      {n === 2 && (
        <span className="sicon-pill">
          <i />
          GO
        </span>
      )}
    </div>
  );
}
