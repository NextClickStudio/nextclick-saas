import Link from "next/link";
import Demo, { MiniOverlay } from "./Demo";
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
                <i className="live" /> Reading every pump.fun launch, live
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
              <p className="lead">Open any memecoin. In one second yeppo tells you if it&apos;s safe, what its creator did before, and if now is the moment.</p>
            </Reveal>
            <Reveal delay={240} className="hero-cta">
              <Link href="/extension" className="btn btn-go btn-lg">
                Add to Chrome · free
              </Link>
              <a href="#how" className="btn btn-lg btn-ghost">
                How it works
              </a>
            </Reveal>
            <Reveal delay={320} className="hero-try">
              <Search label="Read it" />
              <p className="hero-note">Or paste a coin here. No wallet, no sign-up.</p>
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
            <p>Everything you would check by hand, done before you can open a second tab.</p>
          </Reveal>
          <div className="three">
            <Reveal className="card feat" delay={0}>
              <div className="feat-art">
                <div className="art-checks">
                  {["Top 10 hold 14%", "Creator holds 0%", "No insider group", "Liquidity can't be pulled"].map((t, i) => (
                    <div key={t} style={{ "--i": i } as React.CSSProperties}>
                      <i>✓</i>
                      {t}
                    </div>
                  ))}
                </div>
              </div>
              <span className="label" style={{ display: "block", marginTop: 16 }}>
                Safety
              </span>
              <h3>Is it a trap?</h3>
              <p>Holders, creator bag, insider groups, frozen coins, pullable liquidity. One fail and it&apos;s a no.</p>
            </Reveal>
            <Reveal className="card feat" delay={90}>
              <div className="feat-art">
                <MiniOverlay />
              </div>
              <span className="label" style={{ display: "block", marginTop: 16, color: "var(--dev)" }}>
                Creator
              </span>
              <h3>What did they do last time?</h3>
              <p>Every coin the same wallet launched, laid over this one. You see exactly where they dump.</p>
            </Reveal>
            <Reveal className="card feat" delay={180}>
              <div className="feat-art">
                <div className="art-eq">
                  {Array.from({ length: 18 }, (_, i) => (
                    <i key={i} style={{ "--i": i } as React.CSSProperties} />
                  ))}
                </div>
              </div>
              <span className="label" style={{ display: "block", marginTop: 16, color: "var(--up)" }}>
                Moment
              </span>
              <h3>Is now the time?</h3>
              <p>The last minute against the four before: price, buyers, sellers, wallets. Volatility, read live.</p>
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
                <p>The same wallets launch coin after coin and dump them the same way. yeppo remembers every one.</p>
              </div>
              <ul className="cre-list">
                <li>
                  <span>
                    <b>Every coin they made</b> in the last 14 days, with how it ended: rugged, died or ran.
                  </span>
                </li>
                <li>
                  <span>
                    <b>When they usually sell</b>, and at what price. So you sell first.
                  </span>
                </li>
                <li>
                  <span>
                    <b>What they&apos;re doing now</b> on this coin: holding, selling or already out.
                  </span>
                </li>
              </ul>
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
                    ["$MOONDOG", "2h", "×2.6", "sold 3m", "rug"],
                    ["$DOGMOON", "5h", "×2.2", "sold 3m", "rug"],
                    ["$PUPPER", "9h", "×1.4", "sold 2m", "dead"],
                    ["$WOOFY", "1d", "×3.0", "sold 4m", "rug"],
                    ["$BARK", "2d", "×2.4", "sold 3m", "rug"],
                  ].map(([s, a, p, so, f]) => (
                    <div key={s} className="cp-coin">
                      <span>
                        {s} <span className="when">{a} ago</span>
                      </span>
                      <span className="mono mute">{p}</span>
                      <span className="mono dim">{so}</span>
                      <span className={`chip tone fate fate-${f}`}>{f === "rug" ? "Rugged" : "Died"}</span>
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
            <span className="label">The call</span>
            <h2>three words. no noise.</h2>
          </Reveal>
          <div className="words">
            {[
              ["up", "Momentum", "Safe, clean creator, and buyers are piling in right now."],
              ["mid", "Wait", "Nothing wrong, but no push. Wait for volume to come back."],
              ["down", "Don't buy", "A trap, a rugger, or already dumped. Walk away."],
            ].map(([t, w, p], i) => (
              <Reveal key={w} className={`card word t-${t}`} delay={i * 90}>
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
            {[
              ["Add yeppo to Chrome", "Free. Works in Chrome, Brave, Edge and Arc."],
              ["Open any coin", "On pump.fun, GMGN, Axiom, Photon or DexScreener."],
              ["Read the call", "A badge on the page. Click it for the full read."],
            ].map(([h, p], i) => (
              <Reveal key={h} className="card step" delay={i * 90}>
                <span>0{i + 1}</span>
                <h3>{h}</h3>
                <p>{p}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <Reveal className="card final glow-edge">
          <h2>
            trade the move.
            <br />
            <span className="grad">skip the rug.</span>
          </h2>
          <p>Free while in beta. It never touches your wallet.</p>
          <Link href="/extension" className="btn btn-go btn-lg">
            Add to Chrome
          </Link>
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
