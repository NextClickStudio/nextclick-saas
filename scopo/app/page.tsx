import Link from "next/link";
import { CookieNotice } from "@/components/CookieNotice";
import { PhoneDemo } from "@/components/landing/PhoneDemo";
import { RotatingWord } from "@/components/landing/RotatingWord";
import { Logo } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";
import { SearchBox } from "@/components/SearchBox";
import { SiteFooter } from "@/components/SiteFooter";
import { scanHref, type LangCode } from "@/lib/languages";

const MARQUEE_A: Array<[string, string, LangCode]> = [
  ["🎸", "Guitar", "en"],
  ["🏂", "Snowboarding", "en"],
  ["♟️", "Chess", "en"],
  ["🔪", "Cooking", "en"],
  ["⛷️", "Skiing", "en"],
  ["🏛️", "Italian politics", "it"],
  ["📜", "History", "it"],
];
const MARQUEE_B: Array<[string, string, LangCode]> = [
  ["🎹", "Piano", "en"],
  ["📷", "Photography", "en"],
  ["🧠", "Psychology", "en"],
  ["🗣️", "Spanish", "es"],
  ["🏀", "Basketball", "en"],
  ["💶", "Personal finance", "it"],
  ["🔭", "Physics", "it"],
];

const STEPS = [
  { n: "01", title: "Type a topic", text: "Guitar, snowboarding, chess, Roman history. Anything, in the language you want." },
  { n: "02", title: "Tell us what you know", text: "Pick your level and say what you can already do. Scopo scans it and skips the parts you know." },
  { n: "03", title: "Follow your path", text: "Short videos in the right order, one step at a time. Progress saves itself, so you continue anytime." },
];

const PATH_DEMO: Array<["known" | "here" | "next", string, string]> = [
  ["known", "Find your stance", "Regular or goofy"],
  ["known", "Edges & side-slipping", "Control your speed"],
  ["here", "Linking turns", "From C-turns to S-turns"],
  ["next", "The ollie", "The base of every trick"],
  ["next", "Your first 180", "Spin and ride away clean"],
];

export default function Landing() {
  return (
    <div className="landing">
      <div className="aurora" aria-hidden>
        <span className="blob blob-volt" />
        <span className="blob blob-ultra" />
        <span className="blob blob-ion" />
      </div>
      <div className="grain" aria-hidden />

      <header className="nav">
        <Link href="/" aria-label="Scopo home">
          <Logo />
        </Link>
        <span className="pill pill-beta">Free beta</span>
        <nav className="nav-links">
          <a href="#how">How it works</a>
          <a href="#why">Why Scopo</a>
        </nav>
        <Link href="/learn" className="btn btn-ghost btn-sm nav-cta">
          Open app
        </Link>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow enter enter-1">
              <span className="dot dot-volt pulse" /> Free demo · we&apos;re building in public
            </p>
            <h1 className="hero-title enter enter-2">
              Learn <RotatingWord />
              by scrolling.
            </h1>
            <p className="hero-sub enter enter-3">
              Not another endless feed. Tell Scopo what you want to learn and what you already know: it builds an
              ordered path of short videos that starts exactly where you are, and saves it so you can continue anytime.
            </p>
            <div className="enter enter-4">
              <SearchBox variant="hero" />
            </div>
            <p className="hero-try enter enter-5">
              <span>Try</span>
              <Link href={scanHref("Guitar", "en")}>🎸 Guitar</Link>
              <Link href={scanHref("Snowboarding", "en")}>🏂 Snowboarding</Link>
              <Link href={scanHref("Chess", "en")}>♟️ Chess</Link>
              <Link href={scanHref("Italian politics", "it")}>🇮🇹 Italian politics</Link>
            </p>
          </div>
          <div className="hero-visual enter enter-3">
            <PhoneDemo />
          </div>
        </section>

        <section className="marquee" aria-label="Topics people learn">
          {[MARQUEE_A, MARQUEE_B].map((row, r) => (
            <div key={r} className={`marquee-row ${r === 1 ? "marquee-reverse" : ""}`}>
              <div className="marquee-track">
                {[...row, ...row].map(([emoji, label, lang], i) => (
                  <Link key={i} className="marquee-chip" href={scanHref(label, lang)} tabIndex={i >= row.length ? -1 : 0}>
                    <span aria-hidden>{emoji}</span> {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section id="how" className="section">
          <p className="kicker" data-reveal>
            How it works
          </p>
          <h2 className="section-title" data-reveal>
            From &ldquo;I want to learn that&rdquo; to knowing it, one step at a time.
          </h2>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.n} className="step" data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="step-n grad-text">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="why" className="section">
          <p className="kicker" data-reveal>
            Why Scopo
          </p>
          <h2 className="section-title" data-reveal>
            A path, not a feed.
          </h2>

          <div className="bento">
            <article className="tile tile-wide" data-reveal>
              <h3>Starts where you are.</h3>
              <p>
                &ldquo;I can already link turns&rdquo; is enough: Scopo marks what you know and puts you on the next
                step. On TikTok you&apos;d still be watching beginner videos.
              </p>
              <ol className="path-demo">
                {PATH_DEMO.map(([state, title, sub], i) => (
                  <li key={title} className={`pd-row pd-row-${state}`} style={{ transitionDelay: `${300 + i * 140}ms` }}>
                    <span className="pd-node" aria-hidden>
                      {state === "known" ? "✓" : i + 1}
                    </span>
                    <span className="pd-text">
                      <span className="pd-title">{title}</span>
                      <span className="pd-sub">{sub}</span>
                    </span>
                    {state === "known" && <span className="pd-tag">You know this</span>}
                    {state === "here" && <span className="pd-here">Start here</span>}
                  </li>
                ))}
              </ol>
            </article>

            <article className="tile" data-reveal>
              <div className="tile-icon" aria-hidden>
                🎯
              </div>
              <h3>Only what you asked for.</h3>
              <p>Search snowboarding, get snowboarding. Not ski vlogs, not memes, not drama.</p>
            </article>

            <article className="tile" data-reveal>
              <div className="flags" aria-hidden>
                <span>🇬🇧</span>
                <span>🇮🇹</span>
                <span>🇪🇸</span>
                <span>🇫🇷</span>
                <span>🇩🇪</span>
                <span>🇧🇷</span>
              </div>
              <h3>Any language.</h3>
              <p>Learn in your language, or practise another one while you learn.</p>
            </article>

            <article className="tile" data-reveal>
              <svg className="ring" viewBox="0 0 120 120" aria-hidden>
                <circle cx="60" cy="60" r="48" className="ring-bg" />
                <circle cx="60" cy="60" r="48" className="ring-fg" />
                <text x="60" y="58" textAnchor="middle" className="ring-num">
                  3/7
                </text>
                <text x="60" y="78" textAnchor="middle" className="ring-label">
                  saved ✓
                </text>
              </svg>
              <h3>Saved. Continue anytime.</h3>
              <p>Stop after one step on the bus, continue tonight from the exact video you left.</p>
            </article>

            <article className="tile" data-reveal>
              <div className="tile-icon" aria-hidden>
                🧯
              </div>
              <h3>No rage-bait.</h3>
              <p>Drama, fights and clickbait get filtered out before they reach you.</p>
            </article>

            <article className="tile" data-reveal>
              <div className="homescreen" aria-hidden>
                <span className="app-dot" />
                <span className="app-dot" />
                <span className="app-icon-tile">
                  <svg viewBox="0 0 64 64" width="44" height="44">
                    <defs>
                      <linearGradient id="tile-mark" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#c6ff3d" />
                        <stop offset="1" stopColor="#38f3e0" />
                      </linearGradient>
                    </defs>
                    <rect width="64" height="64" rx="16" fill="url(#tile-mark)" />
                    <circle cx="32" cy="32" r="15" fill="none" stroke="#07070c" strokeWidth="5" />
                    <path d="M32 7v8M32 49v8M7 32h8M49 32h8" stroke="#07070c" strokeWidth="5" strokeLinecap="round" />
                    <path d="M28.5 25.5l10 6.5-10 6.5z" fill="#07070c" />
                  </svg>
                </span>
                <span className="app-dot" />
              </div>
              <h3>Install it like an app.</h3>
              <p>Add Scopo to your home screen. Full screen, no browser bars.</p>
            </article>
          </div>
        </section>

        <section className="manifesto" data-reveal>
          <p>
            TikTok shows you what keeps you scrolling.
            <br />
            <span className="grad-text">Scopo shows you what comes next.</span>
          </p>
          <Link href="/learn" className="btn btn-volt btn-lg">
            Build my first path, it&apos;s free
          </Link>
        </section>
      </main>

      <SiteFooter />
      <Reveal />
      <CookieNotice />
    </div>
  );
}
