"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { pct } from "@/lib/format";
import { usePoll } from "@/lib/hooks";
import { flags, MIN_N, TONE_COLOR, verdict } from "@/lib/oracle";
import { inTen } from "@/lib/plain";
import { rpc } from "@/lib/supabase";
import type { Hot, Track } from "@/lib/types";
import { Eye, Num } from "./Bits";
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
  const { data: hot } = usePoll<Hot>(() => rpc<Hot>("yr_oracle_hot"), 20_000, "hot");
  const { data: track } = usePoll<Track | null>(() => rpc<Track | null>("yr_otrack"), 300_000, "track");
  const recorded = hot?.recorded ?? 0;
  return (
    <>
      <TopBar />
      <main className="home">
        <section className="h-hero wrap">
          <div className="h-hero-copy">
            <span className="h-kicker">
              <i className="dot" /> Live on every new pump.fun coin
            </span>
            <h1 className="disp">
              Know when to get in.
              <br />
              <span className="shine">Know when to get out.</span>
            </h1>
            <p className="h-lead">
              yeppo watches every new memecoin from its very first trade. Open one and it tells you, in plain words, what coins like it did next, who
              made it, who is about to sell, and the exact plan to follow before you buy.
            </p>
            <div className="h-cta">
              <Link href="/extension" className="btn btn-glow btn-lg">
                Get the Chrome extension
              </Link>
              <a href="#how" className="btn btn-lg btn-ghost">
                See how it works
              </a>
            </div>
            <p className="h-small">No wallet connection · nothing to sign · works on pump.fun, GMGN, Axiom, Photon, BullX</p>
          </div>
          <HeroArt />
        </section>

        <LiveStrip hot={hot ?? null} track={track ?? null} />

        <section className="wrap h-stats">
          <Reveal>
            <b className="mono">
              <Num value={recorded} fmt={(v) => Math.round(v).toLocaleString("en-US")} />
            </b>
            <span>coins watched from their first trade</span>
          </Reveal>
          <Reveal delay={80}>
            <b className="mono">30</b>
            <span>look-alikes compared for every coin</span>
          </Reveal>
          <Reveal delay={160}>
            <b className="mono">10 s</b>
            <span>between two reads</span>
          </Reveal>
          <Reveal delay={240}>
            <b className="mono">0</b>
            <span>keys, signatures or wallet connections</span>
          </Reveal>
        </section>

        <section id="how" className="wrap h-sec">
          <Reveal className="h-head">
            <span className="h-eyebrow">How it works</span>
            <h2 className="disp">Three seconds between you and a bad trade</h2>
          </Reveal>
          <div className="h-steps">
            <Reveal className="h-step">
              <span className="n">1</span>
              <h3>Open a coin, like you always do</h3>
              <p>On pump.fun, GMGN, Axiom, Photon or BullX. The yeppo extension spots the coin by itself. Nothing to copy or paste.</p>
            </Reveal>
            <Reveal className="h-step" delay={100}>
              <span className="n">2</span>
              <h3>yeppo finds its 30 look-alikes</h3>
              <p>
                Out of every coin it watched since launch, the 30 that moved, traded and were held most like this one, at the same age. Then it
                checks the creator and the holders.
              </p>
            </Reveal>
            <Reveal className="h-step" delay={200}>
              <span className="n">3</span>
              <h3>You get a verdict and a plan</h3>
              <p>One word, one sentence, and an exit plan: where to take profit, where to cut, how long to stay and how much to buy at most.</p>
            </Reveal>
          </div>
        </section>

        <section id="plan" className="wrap h-sec h-split">
          <Reveal className="h-copy">
            <span className="h-eyebrow">Only on yeppo · Exit Plan</span>
            <h2 className="disp">The plan comes before the click</h2>
            <p>
              Most traders do not lose because they pick bad coins. They lose because they have no plan: they hold a winner until it is a loser, they
              hope, they average down.
            </p>
            <p>
              yeppo looks at how the 30 look-alikes really moved, then picks the take profit, the stop and the time limit that worked on them. It even
              replays that plan on those 30 coins and tells you how many times it won.
            </p>
            <ul className="h-list">
              <li>
                <b>Take profit</b> where most look-alikes that went up got to.
              </li>
              <li>
                <b>Cut the loss</b> where almost none of them came back.
              </li>
              <li>
                <b>Buy at most</b> what keeps your loss inside your own limit.
              </li>
            </ul>
          </Reveal>
          <Reveal className="h-mock" delay={120}>
            <PlanMock />
          </Reveal>
        </section>

        <section id="safety" className="wrap h-sec h-split rev">
          <Reveal className="h-mock">
            <SafetyMock />
          </Reveal>
          <Reveal className="h-copy" delay={120}>
            <span className="h-eyebrow">Safety Net</span>
            <h2 className="disp">It watches your bags while you watch the chart</h2>
            <p>
              Add your trading wallet (read-only, like a block explorer) and set two numbers: the most you accept to lose on one trade, and in one day.
            </p>
            <ul className="h-list">
              <li>
                <b>GET OUT</b> when a coin you hold turns dangerous: the dev sells, bots dump, fast sellers hold too much.
              </li>
              <li>
                <b>Slow down</b> after three losses in a row, when traders start chasing.
              </li>
              <li>
                <b>Stop for today</b> when your day limit is hit. The next trade is the one that hurts.
              </li>
            </ul>
            <Link href="/wallet" className="btn btn-ghost">
              Guard my wallet
            </Link>
          </Reveal>
        </section>

        <section className="wrap h-sec">
          <Reveal className="h-head">
            <span className="h-eyebrow">Red flags</span>
            <h2 className="disp">What it catches before you do</h2>
          </Reveal>
          <div className="h-flags">
            {[
              ["🪜", "Bot ladders", "A perfect staircase made only of buys. Bots fake demand this way, then dump on whoever bought."],
              ["🚩", "Serial ruggers", "Every creator gets a record: coins launched, coins rugged, coins that went big. Ruggers get flagged."],
              ["🚨", "Dev already sold", "When the creator dumps their own bag, yeppo tells you at once, on the page and on your bags."],
              ["⏱", "Fast sellers", "yeppo knows how each wallet trades. It tells you how much of the coin sits with wallets that sell within a minute."],
            ].map(([ic, t, d], i) => (
              <Reveal key={t} className="h-flag" delay={i * 80}>
                <span className="ic">{ic}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="wrap h-sec">
          <Reveal className="h-head">
            <span className="h-eyebrow">How to read it</span>
            <h2 className="disp">Five words, no jargon</h2>
          </Reveal>
          <div className="h-legend">
            {[
              ["up", "Runner potential", "Most coins like this went up, few crashed, no red flag."],
              ["mid", "Coin flip", "Some went up, some crashed. No edge: a gamble."],
              ["flat", "Going nowhere", "The look-alikes barely moved. Probably fading out."],
              ["down", "Likely dump", "Many coins like this lost half their value within minutes."],
              ["rug", "Rug risk", "A red flag: a known rugger, a bot ladder, or the dev sold."],
            ].map(([t, l, d], i) => (
              <Reveal key={l} className={`h-lg t-${t}`} delay={i * 60}>
                <b style={{ color: TONE_COLOR[t as keyof typeof TONE_COLOR] }}>{l}</b>
                <p>{d}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <Proof track={track ?? null} />

        <section className="wrap h-sec">
          <Reveal className="h-final">
            <Eye size={54} />
            <h2 className="disp">Trade memecoins with a plan</h2>
            <p>Install the extension, open any coin, and read it before you buy.</p>
            <div className="h-cta">
              <Link href="/extension" className="btn btn-glow btn-lg">
                Get the Chrome extension
              </Link>
              <Link href="/pricing" className="btn btn-lg btn-ghost">
                See pricing
              </Link>
            </div>
          </Reveal>
        </section>

        <section className="wrap h-sec">
          <Reveal className="h-head">
            <span className="h-eyebrow">Questions</span>
            <h2 className="disp">Straight answers</h2>
          </Reveal>
          <div className="faq">
            {[
              ["Will yeppo make me win every trade?", "No, and nobody can promise that. yeppo tells you what coins like this one did, catches the red flags and gives you a plan with limits. It makes losing big much harder. It does not make memecoins safe."],
              ["Do I have to connect my wallet?", "Never. yeppo only reads public data from the Solana chain. For the Safety Net you paste a public wallet address, like on any block explorer. There is nothing to sign."],
              ["Which coins does it read?", "pump.fun coins that yeppo watched from their first trade, during their first 40 minutes, where almost all of the action is."],
              ["How do I pay?", "In SOL, straight from your wallet. No account and no card. You get a key that unlocks the extension."],
              ["Is this financial advice?", "No. Everything yeppo shows comes from what past coins did. Only trade money you can afford to lose."],
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

/** the hero picture: a coin's chart drawing itself, then 30 possible futures fanning out from "now" */
function HeroArt() {
  const ghosts = useMemo(() => {
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 22 }, (_, i) => {
      const drift = (rnd() - 0.48) * 1.6;
      let y = 150;
      let d = "M300 150";
      for (let x = 320; x <= 600; x += 20) {
        y += drift * 9 + (rnd() - 0.5) * 22;
        y = Math.max(20, Math.min(290, y));
        d += ` L${x} ${y.toFixed(1)}`;
      }
      return { d, up: y < 150, i };
    });
  }, []);
  return (
    <div className="h-art" aria-hidden>
      <svg viewBox="0 0 600 310" preserveAspectRatio="none">
        <defs>
          <linearGradient id="hpast" x1="0" x2="1">
            <stop offset="0" stopColor="#7c5cff" />
            <stop offset="1" stopColor="#2dd4ee" />
          </linearGradient>
        </defs>
        {[60, 120, 180, 240].map((y) => (
          <line key={y} x1="0" x2="600" y1={y} y2={y} className="h-gridline" />
        ))}
        {ghosts.map((g) => (
          <path key={g.i} d={g.d} className={`h-ghost ${g.up ? "g-up" : "g-down"}`} style={{ animationDelay: `${1.4 + g.i * 0.06}s` }} />
        ))}
        <path d="M0 230 L30 222 L60 228 L90 200 L120 206 L150 180 L180 188 L210 166 L240 172 L270 152 L300 150" className="h-past" stroke="url(#hpast)" />
        <line x1="300" x2="300" y1="10" y2="300" className="h-now" />
        <circle cx="300" cy="150" r="5" className="h-dot" />
      </svg>
      <div className="h-card">
        <div className="h-card-top">
          <Eye size={18} />
          <b>yeppo</b>
          <span className="mono">$PEPE2</span>
        </div>
        <div className="h-card-v">
          <b>Runner potential</b>
          <span className="mono">72</span>
        </div>
        <p>9 of the 30 look-alikes went up 50%, only 2 crashed.</p>
        <div className="h-card-plan">
          <span>
            Take profit <b className="up">+45%</b>
          </span>
          <span>
            Cut <b className="down">−25%</b>
          </span>
          <span>
            Within <b>4 min</b>
          </span>
        </div>
      </div>
    </div>
  );
}

/** a ribbon of what the oracle is saying right now, from the live board */
function LiveStrip({ hot, track }: { hot: Hot | null; track: Track | null }) {
  const items = useMemo(() => {
    const out: { sym: string; label: string; tone: string }[] = [];
    for (const c of hot?.coins ?? []) {
      const o = c[10];
      if (!o || o.old || o.n < MIN_N || !o.odds?.k) continue;
      const sig = { ladder: !!c[11]?.ladder, devSold: false, dev: c[12] ?? null };
      const v = verdict(o.odds, o.base, sig, track);
      const fl = flags(sig);
      out.push({ sym: c[2] ? `$${c[2].replace(/^\$/, "").slice(0, 10)}` : c[0].slice(0, 6), label: fl[0]?.tone === "down" ? fl[0].text.split(":")[0] : v.label, tone: v.tone });
    }
    return out;
  }, [hot, track]);
  if (items.length < 3) return null;
  const row = [...items, ...items];
  return (
    <div className="h-strip" aria-label="What yeppo is reading right now">
      <span className="h-strip-tag">
        <i className="dot" /> Live
      </span>
      <div className="h-strip-track">
        {row.map((it, i) => (
          <span key={i} className={`h-strip-item t-${it.tone}`}>
            <b>{it.sym}</b> {it.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function PlanMock() {
  return (
    <div className="mock">
      <div className="mock-top">
        <span className="mock-coin">PE</span>
        <div>
          <b>$PEPE2</b>
          <span>6 min old · $38.2k</span>
        </div>
        <span className="mock-score up">72</span>
      </div>
      <div className="mock-plan">
        <header>
          <b>Exit plan</b>
          <span className="up">Worked on the look-alikes</span>
        </header>
        <div className="mock-grid">
          <div>
            <span>Take profit</span>
            <b className="up mono">+45%</b>
          </div>
          <div>
            <span>Cut the loss</span>
            <b className="down mono">−25%</b>
          </div>
          <div>
            <span>Get out within</span>
            <b className="mono">4 min</b>
          </div>
          <div>
            <span>Buy at most</span>
            <b className="mono">0.40 SOL</b>
          </div>
        </div>
        <div className="mock-replay">
          <span className="up">16 won</span>
          <span className="down">9 lost</span>
          <span>5 even</span>
          <span className="up">avg +11%</span>
        </div>
      </div>
      <p className="mock-note">Replayed on the 30 coins that looked most like this one. A plan from past coins, not a promise.</p>
    </div>
  );
}

function SafetyMock() {
  return (
    <div className="mock">
      <div className="mock-net">
        <b>✋ Slow down</b>
        <span>3 losing trades in a row. Take a 15 minute break.</span>
      </div>
      <div className="mock-row">
        <div>
          <span>Today</span>
          <b className="down mono">−0.31 SOL</b>
        </div>
        <div>
          <span>Day limit</span>
          <b className="mono">−0.50 SOL</b>
        </div>
      </div>
      <div className="mock-meter">
        <i style={{ width: "62%" }} />
      </div>
      {[
        ["$WIF3", "GET OUT", "a-out", "The dev sold their bag.", "+38%"],
        ["$CATZ", "WATCH", "a-watch", "18% of the supply could be sold in the next minute.", "−6%"],
        ["$LUNA9", "HOLD", "a-hold", "13 of the 30 look-alikes went up 50%+.", "+21%"],
      ].map(([s, a, c, w, p]) => (
        <div key={s} className={`mock-bag ${c}`}>
          <div>
            <b>{s}</b>
            <p>{w}</p>
          </div>
          <span className={`alarm ${c}`}>{a}</span>
          <b className={`mono ${p.startsWith("+") ? "up" : "down"}`}>{p}</b>
        </div>
      ))}
    </div>
  );
}

/** what the backtest found, and the live hourly replay once enough coins have finished */
function Proof({ track }: { track: Track | null }) {
  const live = track && (track.down?.n ?? 0) >= 20 ? track : null;
  return (
    <section className="wrap h-sec">
      <Reveal className="h-head">
        <span className="h-eyebrow">Proof</span>
        <h2 className="disp">Tested on coins it could not see the end of</h2>
        <p className="h-sub">
          yeppo replays its own calls on past coins, using only what it knew at the time. No peeking at what happened next.
        </p>
      </Reveal>
      <div className="h-proof">
        <Reveal className="h-pcard">
          <span>When yeppo says “Likely dump”</span>
          <b className="down mono">{live?.down.dump50 != null ? inTen(live.down.dump50) : "7 in 10"}</b>
          <p>really lost half their value within 10 minutes.</p>
          <i>A random coin: {live ? inTen(live.all.dump50) : "under 2 in 10"}</i>
        </Reveal>
        <Reveal className="h-pcard" delay={100}>
          <span>When the look-alikes say “up 50%”</span>
          <b className="up mono">{live?.up.hit50 != null ? inTen(live.up.hit50) : "3.5 in 10"}</b>
          <p>really went up 50% within 10 minutes.</p>
          <i>A random coin: {live ? inTen(live.all.hit50) : "under 1 in 10"}</i>
        </Reveal>
        <Reveal className="h-pcard" delay={200}>
          <span>Bot ladders</span>
          <b className="down mono">0 in 10</b>
          <p>of the staircase pumps yeppo flagged went up. On average they lost half.</p>
          <i>That is why they are a red flag</i>
        </Reveal>
      </div>
      <p className="h-honest">
        {live
          ? `Live replay on ${live.coins.toLocaleString("en-US")} coins, updated every hour.`
          : "Measured in October 2026 on active coins 5 minutes after launch."}{" "}
        Honest note: buying every good call blindly still loses money{live?.up.ret != null ? ` (${pct(live.up.ret, 1)} per trade)` : ""}. yeppo&apos;s
        biggest edge is telling you what to avoid, and when to leave.
      </p>
    </section>
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
          <p>Reads every new memecoin so you do not trade blind. Data from the Solana chain, read live.</p>
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
            <Link href="/risk">Risk disclosure</Link>
          </div>
        </div>
      </div>
      <div className="wrap foot-note">
        Odds come from what past coins did. They are not a promise and not financial advice. Memecoins can go to zero in seconds. Only trade what
        you can afford to lose.
      </div>
    </footer>
  );
}
