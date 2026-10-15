"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getLanguage, LANGUAGES, scanHref, type LangCode } from "@/lib/languages";
import { LEVELS, type Level, type PlanResponse } from "@/lib/paths";
import { pathFromPlan, savePath } from "./paths";
import { saveLang } from "./prefs";

const EXAMPLES: Array<[RegExp, string]> = [
  [/guitar|chitarra|guitarra/i, "e.g. I can play a few open chords, but barre chords are hard."],
  [/snowboard/i, "e.g. I can link turns, but I've never tried an ollie."],
  [/chess|scacchi|ajedrez/i, "e.g. I know how the pieces move, but I lose to simple tactics."],
  [/ski/i, "e.g. I ski blue runs, but my turns still skid."],
];

const SCAN_LINES = [
  "Reading what you already know…",
  "Mapping the topic, from zero to advanced…",
  "Putting the steps in the right order…",
  "Finding your starting point…",
];

type Props = { topic: string; lang: LangCode };

export function ScanFlow({ topic, lang: initialLang }: Props) {
  const router = useRouter();
  const [lang, setLang] = useState<LangCode>(initialLang);
  const [level, setLevel] = useState<Level>("new");
  const [known, setKnown] = useState("");
  const [phase, setPhase] = useState<"form" | "scanning">("form");
  const [line, setLine] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Extract<PlanResponse, { notice: string }> | null>(null);

  const example = EXAMPLES.find(([re]) => re.test(topic))?.[1] ?? "e.g. I know the basics, but I always get stuck on…";
  const language = getLanguage(lang);

  useEffect(() => {
    if (phase !== "scanning") return;
    const id = window.setInterval(() => setLine((l) => Math.min(l + 1, SCAN_LINES.length - 1)), 900);
    return () => window.clearInterval(id);
  }, [phase]);

  async function scan() {
    setPhase("scanning");
    setLine(0);
    setError(null);
    saveLang(lang);
    try {
      const [res] = await Promise.all([
        fetch("/api/path", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ topic, lang, level, known }),
        }),
        new Promise((r) => setTimeout(r, 2600)),
      ]);
      const data = (await res.json()) as PlanResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "We couldn't build your path.");
      if ("notice" in data) {
        setNotice(data);
        setPhase("form");
        return;
      }
      const saved = savePath(pathFromPlan(data.plan, level, known));
      router.replace(`/path/${saved.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't build your path.");
      setPhase("form");
    }
  }

  if (phase === "scanning") {
    return (
      <main className="scan-screen" aria-live="polite">
        <div className="aurora aurora-soft" aria-hidden>
          <span className="blob blob-volt" />
          <span className="blob blob-ultra" />
        </div>
        <div className="radar" aria-hidden>
          <span className="radar-sweep" />
          <span className="radar-ring r1" />
          <span className="radar-ring r2" />
          <span className="radar-dot d1" />
          <span className="radar-dot d2" />
          <span className="radar-dot d3" />
        </div>
        <p className="scan-topic">{topic}</p>
        <ol className="scan-lines">
          {SCAN_LINES.map((l, i) => (
            <li key={l} className={i < line ? "is-done" : i === line ? "is-now" : ""}>
              <span className="scan-tick" aria-hidden>
                {i < line ? "✓" : ""}
              </span>
              {l}
            </li>
          ))}
        </ol>
      </main>
    );
  }

  return (
    <main className="app-screen scan-form">
      <div className="aurora aurora-soft" aria-hidden>
        <span className="blob blob-volt" />
        <span className="blob blob-ultra" />
      </div>

      <header className="screen-top">
        <Link href="/learn" className="icon-btn" aria-label="Back">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <span className="screen-kicker">New path</span>
      </header>

      <div className="enter enter-1">
        <h1 className="scan-title">{topic}</h1>
        <label className="lang-pill lang-pill-inline" title="Language of the videos">
          <span className="lang-flag" aria-hidden>
            {language.flag}
          </span>
          <span className="lang-name">{language.label} videos</span>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <select value={lang} onChange={(e) => setLang(e.target.value as LangCode)} aria-label="Language of the videos">
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notice ? (
        <section className="scan-notice enter enter-2">
          <p className="state-emoji" aria-hidden>
            🧭
          </p>
          <h2>&ldquo;{topic}&rdquo; isn&apos;t in the demo yet</h2>
          <p>{notice.notice}</p>
          <div className="chips">
            {notice.suggestions.map((s) => (
              <Link key={s.topic} className="chip" href={scanHref(s.topic, s.lang)}>
                <span aria-hidden>{s.emoji}</span> {s.topic}
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="enter enter-2">
            <h2 className="scan-q">Where are you starting from?</h2>
            <div className="levels" role="radiogroup" aria-label="Your level">
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={level === l.id}
                  className={`level ${level === l.id ? "is-on" : ""}`}
                  onClick={() => setLevel(l.id)}
                >
                  <span className="level-emoji" aria-hidden>
                    {l.emoji}
                  </span>
                  <span className="level-title">{l.title}</span>
                  <span className="level-hint">{l.hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="enter enter-3">
            <h2 className="scan-q">
              What can you already do? <span className="scan-optional">optional</span>
            </h2>
            <textarea
              className="known-input"
              value={known}
              onChange={(e) => setKnown(e.target.value)}
              placeholder={example}
              maxLength={500}
              rows={3}
            />
            <p className="scan-help">We skip what you already know and start you exactly where you are.</p>
          </section>

          {error && <p className="scan-error">{error}</p>}

          <div className="sticky-cta">
            <button type="button" className="btn btn-volt btn-block" onClick={scan}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2.2" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              Scan &amp; build my path
            </button>
          </div>
        </>
      )}
    </main>
  );
}
