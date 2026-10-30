"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePoll } from "@/lib/hooks";
import { checksOf, decide, MIN_N, TONE_COLOR, verdict } from "@/lib/oracle";
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

type Live = { sym: string; label: string; tone: keyof typeof TONE_COLOR; score: number; p50: number; dump: number };

/** what the oracle says right now about the board's coins, for the hero card and the ribbon */
function useLive(): { live: Live[]; recorded: number } {
  const { data: hot } = usePoll<Hot>(() => rpc<Hot>("yr_oracle_hot"), 20_000, "hot");
  const { data: track } = usePoll<Track | null>(() => rpc<Track | null>("yr_otrack"), 300_000, "track");
  const live = useMemo(() => {
    const out: Live[] = [];
    for (const c of hot?.coins ?? []) {
      const o = c[10];
      if (!o || o.old || o.n < MIN_N || !o.odds?.k) continue;
      const sig = { ladder: !!c[11]?.ladder, devSold: false, dev: c[12] ?? null };
      const v = verdict(o.odds, o.base, sig, track ?? null);
      const d = decide(v, checksOf(o.f, sig));
      out.push({ sym: c[2] ? `$${c[2].replace(/^\$/, "").slice(0, 10)}` : c[0].slice(0, 6), label: d.word, tone: d.tone, score: v.score, p50: o.odds.p50, dump: o.odds.dump });
    }
    return out;
  }, [hot, track]);
  return { live, recorded: hot?.recorded ?? 0 };
}

export default function Home() {
  const { live, recorded } = useLive();
  return (
    <>
      <TopBar />
      <main className="home">
        <section className="x-hero wrap">
          <div className="x-hero-copy">
            <span className="x-pill">
              <i className="dot" /> Reading every new pump.fun coin, live
            </span>
            <h1 className="disp">
              Trade memecoins
              <br />
              <span className="shine">with a plan.</span>
            </h1>
            <p className="x-lead">See what coins like this one did next, before you buy. Then know exactly when to sell.</p>
            <div className="x-cta">
              <Link href="/extension" className="btn btn-glow btn-lg">
                Get the extension
              </Link>
              <a href="#how" className="btn btn-lg btn-ghost">
                How it works
              </a>
            </div>
          </div>
          <HeroCard live={live} />
        </section>

        <Ribbon live={live} />

        <section className="wrap x-stats">
          {[
            [recorded, "coins watched from launch"],
            [30, "look-alikes per read"],
            [10, "seconds between reads"],
            [0, "wallet connections"],
          ].map(([v, l], i) => (
            <Reveal key={l} delay={i * 70}>
              <b className="mono">
                <Num value={Number(v)} fmt={(x) => Math.round(x).toLocaleString("en-US")} />
              </b>
              <span>{l}</span>
            </Reveal>
          ))}
        </section>

        <Story />

        <section className="wrap x-sec">
          <Reveal className="x-head">
            <h2 className="disp">Built to stop the big losses</h2>
          </Reveal>
          <div className="x-bento">
            <Reveal className="x-tile big">
              <PlanArt />
              <h3>Exit Plan</h3>
              <p>Take profit, stop and time limit, picked from what the 30 look-alikes really did.</p>
            </Reveal>
            <Reveal className="x-tile" delay={80}>
              <MeterArt />
              <h3>Safety Net</h3>
              <p>Your limits per trade and per day. yeppo says stop when you hit them.</p>
            </Reveal>
            <Reveal className="x-tile" delay={160}>
              <LadderArt />
              <h3>Bot ladders</h3>
              <p>Fake staircase pumps, flagged before they dump.</p>
            </Reveal>
            <Reveal className="x-tile big" delay={120}>
              <DevArt />
              <h3>Creator record</h3>
              <p>Every creator&apos;s past coins: how many rugged, how many ran.</p>
            </Reveal>
          </div>
        </section>

        <section className="wrap x-sec">
          <Reveal className="x-head">
            <h2 className="disp">Tested, without peeking</h2>
            <p>yeppo replays its own calls on past coins, using only what it knew at the time.</p>
          </Reveal>
          <div className="x-proof">
            <Reveal className="x-num">
              <b className="down mono">7/10</b>
              <span>Dump calls that really lost half within 10 min</span>
            </Reveal>
            <Reveal className="x-num" delay={90}>
              <b className="mono">&lt;2/10</b>
              <span>coins that do, on average</span>
            </Reveal>
            <Reveal className="x-num" delay={180}>
              <b className="up mono">4×</b>
              <span>more +50% runs when the look-alikes ran</span>
            </Reveal>
          </div>
          <p className="x-honest">Odds from past coins, not promises. yeppo&apos;s edge is mostly what it tells you to skip.</p>
        </section>

        <section className="wrap x-sec">
          <Reveal className="x-final">
            <Eye size={56} />
            <h2 className="disp">Read the coin before you buy it.</h2>
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
              ["Will I win every trade?", "No one can promise that. yeppo shows the odds, the red flags and a plan with limits, so losing big gets much harder."],
              ["Do I connect my wallet?", "Never. yeppo reads public chain data. For the Safety Net you paste a public address. Nothing to sign."],
              ["Which coins does it read?", "pump.fun coins it watched from their first trade, during their first 40 minutes."],
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

/** the hero's card: the live reads, one after the other, or a sample while they load */
function HeroCard({ live }: { live: Live[] }) {
  const sample: Live[] = [
    { sym: "$PEPE2", label: "OK to buy", tone: "up", score: 72, p50: 0.3, dump: 0.07 },
    { sym: "$GIGA", label: "Don't buy", tone: "down", score: 18, p50: 0.1, dump: 0.47 },
    { sym: "$CATZ", label: "Risky", tone: "mid", score: 51, p50: 0.23, dump: 0.2 },
  ];
  const list = live.length >= 3 ? live : sample;
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => x + 1), 3200);
    return () => clearInterval(t);
  }, []);
  const c = list[i % list.length];
  const color = TONE_COLOR[c.tone];
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <div className="x-card-wrap" aria-hidden>
      <div className="x-orbit" />
      <div className={`x-card t-${c.tone}`} key={i}>
        <div className="x-card-top">
          <Eye size={18} />
          <b>yeppo</b>
          <span className="x-live">
            <i className="dot" /> {live.length >= 3 ? "live" : "sample"}
          </span>
        </div>
        <div className="x-card-main">
          <svg width="84" height="84" viewBox="0 0 84 84">
            <circle cx="42" cy="42" r={R} stroke="rgba(255,255,255,.07)" strokeWidth="6" fill="none" />
            <circle
              className="x-ring"
              cx="42"
              cy="42"
              r={R}
              stroke={color}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={C}
              style={{ strokeDashoffset: C * (1 - c.score / 100) }}
              transform="rotate(-90 42 42)"
            />
            <text x="42" y="48" textAnchor="middle" className="x-ring-n">
              {c.score}
            </text>
          </svg>
          <div>
            <span className="mono x-sym">{c.sym}</span>
            <b style={{ color }}>{c.label}</b>
          </div>
        </div>
        <div className="x-bars">
          <div>
            <span>went up 50%</span>
            <i>
              <em className="up-bg" style={{ width: `${c.p50 * 100}%` }} />
            </i>
            <b className="mono">{Math.round(c.p50 * 30)}/30</b>
          </div>
          <div>
            <span>fell 50%</span>
            <i>
              <em className="down-bg" style={{ width: `${c.dump * 100}%` }} />
            </i>
            <b className="mono">{Math.round(c.dump * 30)}/30</b>
          </div>
        </div>
      </div>
    </div>
  );
}

function Ribbon({ live }: { live: Live[] }) {
  if (live.length < 3) return null;
  const row = [...live, ...live];
  return (
    <div className="x-ribbon" aria-label="What yeppo is reading right now">
      <div className="x-ribbon-track">
        {row.map((it, n) => (
          <span key={n} className={`t-${it.tone}`}>
            <b>{it.sym}</b> {it.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** three steps on the left, one screen on the right that changes with them */
function Story() {
  const [step, setStep] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) if (e.isIntersecting) setStep(Number((e.target as HTMLElement).dataset.i));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  const steps = [
    ["Open any coin", "On pump.fun, GMGN, Axiom, Photon or BullX. yeppo spots it by itself."],
    ["It finds 30 look-alikes", "Coins that moved, traded and were held the same way, at the same age."],
    ["You get the call and the plan", "One word, the odds, and where to take profit or cut."],
  ];
  return (
    <section id="how" className="wrap x-story">
      <div className="x-steps">
        {steps.map(([t, d], i) => (
          <div key={t} data-i={i} ref={(el) => void (refs.current[i] = el)} className={`x-step ${step === i ? "on" : ""}`}>
            <span className="mono">0{i + 1}</span>
            <h3 className="disp">{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </div>
      <div className="x-screen-wrap">
        <div className={`x-screen s${step}`}>
          <div className="x-url">
            <i />
            <i />
            <i />
            <span className="mono">pump.fun/coin/7xKX…pump</span>
          </div>
          <div className="x-scr-body">
            <svg viewBox="0 0 300 150" preserveAspectRatio="none" className="x-scr-chart">
              <path d="M0 120 L25 112 L50 116 L75 92 L100 98 L125 78 L150 75" className="x-past" />
              {[
                "M150 75 L180 60 L210 52 L240 40 L270 30 L300 22",
                "M150 75 L180 70 L210 62 L240 66 L270 55 L300 50",
                "M150 75 L180 82 L210 76 L240 84 L270 80 L300 78",
                "M150 75 L180 90 L210 104 L240 118 L270 130 L300 140",
                "M150 75 L180 66 L210 80 L240 98 L270 110 L300 126",
                "M150 75 L180 72 L210 58 L240 50 L270 46 L300 38",
                "M150 75 L180 86 L210 96 L240 92 L270 104 L300 112",
              ].map((d, i) => (
                <path key={d} d={d} className={`x-ghost ${i === 3 || i === 4 || i === 6 ? "dn" : "upl"}`} style={{ animationDelay: `${i * 70}ms` }} />
              ))}
              <line x1="150" x2="150" y1="0" y2="150" className="x-nowline" />
            </svg>
            <div className="x-badge">
              <Eye size={14} /> yeppo <b>OK to buy</b>
            </div>
            <div className="x-plan">
              <div>
                <span>Take profit</span>
                <b className="up mono">+45%</b>
              </div>
              <div>
                <span>Cut</span>
                <b className="down mono">−25%</b>
              </div>
              <div>
                <span>Within</span>
                <b className="mono">4 min</b>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
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
