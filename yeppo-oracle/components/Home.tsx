"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Eye } from "./Bits";
import RadarBoard from "./Radar";
import TopBar from "./TopBar";

/** fades its children in the first time they scroll into view */
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`rv ${on ? "in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export default function Home() {
  return (
    <>
      <TopBar />
      <main className="home">
        <section className="x-hero x-hero-radar wrap">
          <div className="x-hero-copy">
            <span className="x-pill">
              <i className="dot" /> Live radar of every new pump.fun coin
            </span>
            <h1 className="disp">
              Find the coin worth a shot.
              <br />
              <span className="shine">Skip the scams.</span>
            </h1>
            <p className="x-lead">
              yeppo watches every launch, throws out the ones that fail the scam checks, and ranks the rest by who is buying, the post on X
              they ride and the meme of the hour.
            </p>
            <div className="x-cta">
              <Link href="/extension" className="btn btn-glow btn-lg">
                Get the extension
              </Link>
              <a href="#how" className="btn btn-lg btn-ghost">
                How it picks
              </a>
            </div>
          </div>
        </section>

        <section className="wrap x-radar">
          <RadarBoard limit={12} />
        </section>

        <section id="how" className="wrap x-sec">
          <Reveal className="x-head">
            <h2 className="disp">How yeppo picks</h2>
            <p>Three steps, every 20 seconds, on the 40 most traded young coins.</p>
          </Reveal>
          <div className="x-bento">
            <Reveal className="x-tile big">
              <DevArt />
              <h3>1 · Throw out the scams</h3>
              <p>
                Top 10 wallets over 25%, creator over 5%, snipers over 15%, a creator who rugged before, bots faking a climb, or similar coins that
                crashed: out, whatever the hype.
              </p>
            </Reveal>
            <Reveal className="x-tile" delay={80}>
              <MeterArt />
              <h3>2 · Rank what is left</h3>
              <p>Buyers right now, the post on X it was launched from, the meme of the hour, paid promotion. Similar past coins count, a little.</p>
            </Reveal>
            <Reveal className="x-tile" delay={160}>
              <PlanArt />
              <h3>3 · Plan the exit</h3>
              <p>When to take profit, when to cut, how long to stay and how much to buy for your limit.</p>
            </Reveal>
            <Reveal className="x-tile big" delay={120}>
              <LadderArt />
              <h3>In your browser</h3>
              <p>Open a coin on pump.fun, GMGN or Axiom: the extension says OK to buy, Risky or Don&apos;t buy, and why. No coin open: it shows the radar.</p>
            </Reveal>
          </div>
        </section>

        <section className="wrap x-sec">
          <Reveal className="x-head">
            <h2 className="disp">Tested, without peeking</h2>
            <p>yeppo replays its own answers on 2,833 past coins, using only what it knew at the time.</p>
          </Reveal>
          <div className="x-proof">
            <Reveal className="x-num">
              <b className="down mono">41%</b>
              <span>of Don&apos;t buy coins lost half within 10 min</span>
            </Reveal>
            <Reveal className="x-num" delay={90}>
              <b className="mono">27%</b>
              <span>of all coins did</span>
            </Reveal>
            <Reveal className="x-num" delay={180}>
              <b className="up mono">7%</b>
              <span>of the coins yeppo let through did</span>
            </Reveal>
          </div>
          <p className="x-honest">
            Passing the checks means fewer crashes, not a sure win: after fees, most coins still lose. Buy small and follow the stop.
          </p>
        </section>

        <section className="wrap x-sec">
          <Reveal className="x-final">
            <Eye size={56} />
            <h2 className="disp">Know what to skip before you click buy.</h2>
            <div className="x-cta">
              <Link href="/extension" className="btn btn-glow btn-lg">
                Get the extension
              </Link>
              <Link href="/pricing" className="btn btn-lg btn-ghost">
                Pricing
              </Link>
            </div>
          </Reveal>
        </section>

        <section className="wrap x-sec x-last">
          <div className="faq">
            {[
              ["Will I win every trade?", "No one can promise that. yeppo throws out the coins that look like scams and gives you a plan with limits, so losing big gets much harder."],
              ["Does yeppo read X?", "It reads the post on X a coin was launched from, through X's public embed. It does not log in to X or scrape it."],
              ["Do I connect my wallet?", "Never. yeppo reads public chain data. For the Safety Net you paste a public address. Nothing to sign."],
              ["Which coins does it read?", "pump.fun coins it watched from their first trade, in their first 40 minutes. Coins from other launchpads get the market numbers only."],
              ["How do I pay?", "In SOL, from any wallet. No account, no card."],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function PlanArt() {
  return (
    <svg className="art" viewBox="0 0 320 120" preserveAspectRatio="none" aria-hidden>
      <line x1="0" x2="320" y1="28" y2="28" className="art-tp" />
      <line x1="0" x2="320" y1="96" y2="96" className="art-stop" />
      <text x="6" y="22" className="art-t up">take profit +45%</text>
      <text x="6" y="112" className="art-t down">cut −25%</text>
      <path d="M0 70 L40 66 L80 72 L120 58 L160 62 L200 46 L240 40 L280 28" className="art-line" />
      <circle cx="280" cy="28" r="5" className="art-hit" />
    </svg>
  );
}

function MeterArt() {
  return (
    <div className="art art-meter" aria-hidden>
      <div className="m-row">
        <span>today</span>
        <b className="mono down">−0.31 SOL</b>
      </div>
      <div className="m-bar">
        <i />
      </div>
      <span className="m-chip">Slow down</span>
    </div>
  );
}

function LadderArt() {
  return (
    <svg className="art" viewBox="0 0 200 120" aria-hidden>
      <path d="M10 104 L30 104 L30 90 L50 90 L50 76 L70 76 L70 62 L90 62 L90 48 L110 48 L110 34 L130 34 L130 22 L150 22 L168 108 L190 112" className="art-ladder" />
    </svg>
  );
}

function DevArt() {
  const coins = [1, 0, 0, 1, 2, 0, 0, 0, 1, 0, 0, 0];
  return (
    <div className="art art-dev" aria-hidden>
      {coins.map((c, i) => (
        <i key={i} className={c === 2 ? "ran" : c === 1 ? "ok" : "rug"} style={{ animationDelay: `${i * 90}ms` }} />
      ))}
      <span className="mono">9 rugged · 1 ran · 2 alive</span>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-brand">
          <Link href="/" className="logo disp">
            <Eye size={24} />
            <b>yeppo</b>
          </Link>
          <p>Reads every new memecoin, so you never trade blind.</p>
        </div>
        <div className="foot-cols">
          <div>
            <b>Product</b>
            <Link href="/extension">Extension</Link>
            <Link href="/wallet">Wallet</Link>
            <Link href="/pricing">Pricing</Link>
          </div>
          <div>
            <b>Legal</b>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/risk">Risk</Link>
          </div>
        </div>
      </div>
      <div className="wrap foot-note">Not financial advice. Memecoins can go to zero in seconds. Only trade what you can afford to lose.</div>
    </footer>
  );
}
