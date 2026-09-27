"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { INTRO, INTRO_CTA } from "@/content/intro";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Bolt, Flame } from "./learn/Icons";
import { VisualTile } from "./learn/VisualTile";
import { Wordmark } from "./Wordmark";

/** Full-screen intro, swipe through the screens, then sign in with Google. */
export function Intro() {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const onScroll = () => {
    const el = scroller.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  const go = (i: number) => scroller.current?.scrollTo({ left: i * scroller.current.clientWidth, behavior: "smooth" });

  const signIn = async () => {
    setLoading(true);
    await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <main className="fixed inset-0 flex flex-col bg-bg">
      <div className="absolute top-0 right-0 left-0 z-10 flex items-center justify-between px-5 pt-6">
        <Wordmark />
        {index < INTRO.length - 1 && (
          <button onClick={() => go(INTRO.length - 1)} className="rounded-full bg-surface px-4 py-2 text-sm font-bold text-muted">
            Skip
          </button>
        )}
      </div>

      <div ref={scroller} onScroll={onScroll} className="no-scrollbar flex flex-1 snap-x snap-mandatory overflow-x-auto">
        {INTRO.map((s, i) => (
          <section key={i} className="relative flex h-full w-full shrink-0 snap-center flex-col justify-end px-6 pt-24 pb-36">
            <div className="flex flex-1 items-center justify-center">
              {s.kind === "type" && <Collage />}
              {s.kind === "lesson" && <MockQuestion />}
              {s.kind === "streak" && <MockStreak />}
              {s.kind === "duel" && <MockDuel />}
            </div>
            <div className="mx-auto w-full max-w-md">
              {s.eyebrow && <p className="eyebrow">{s.eyebrow}</p>}
              {s.kind === "type" ? (
                <Typewriter text={s.title} active={index === i} />
              ) : (
                <h1 className="headline mt-3 text-[2.6rem] leading-[1.02] sm:text-5xl">{s.title}</h1>
              )}
              {s.body && <p className="mt-4 text-lg leading-snug text-muted">{s.body}</p>}
            </div>
          </section>
        ))}
      </div>

      <div className="absolute right-0 bottom-0 left-0 px-6 pb-8">
        <div className="mx-auto max-w-md">
          <div className="mb-5 flex justify-center gap-2">
            {INTRO.map((_, i) => (
              <button
                key={i}
                aria-label={`Screen ${i + 1}`}
                onClick={() => go(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-8 bg-ivory" : "w-1.5 bg-surface-2"}`}
              />
            ))}
          </div>
          {index === INTRO.length - 1 ? (
            <button
              onClick={signIn}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-ivory py-4 text-lg font-bold text-bg transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              <GoogleMark />
              {loading ? "Opening Google…" : INTRO_CTA}
            </button>
          ) : (
            <button onClick={() => go(index + 1)} className="w-full rounded-2xl bg-surface py-4 text-lg font-bold transition-transform active:scale-[0.98]">
              Next
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function Typewriter({ text, active }: { text: string; active: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setN(i);
      if (i >= text.length) clearInterval(id);
    }, 55);
    return () => clearInterval(id);
  }, [active, text]);
  return (
    <h1 className="headline min-h-[8rem] text-[2.9rem] leading-[1.02] sm:text-6xl">
      {text.slice(0, n)}
      <span className="ml-0.5 inline-block h-[0.9em] w-[3px] translate-y-[0.1em] animate-pulse bg-ivory" />
    </h1>
  );
}

const WORDS = ["Chanel", "New Look", "Tweed", "Birkin", "Bias cut", "Margiela", "Houndstooth", "Le Smoking", "Savile Row", "Tabi", "Balenciaga", "Peak lapel"];

function Collage() {
  return (
    <div className="flex max-w-sm flex-wrap justify-center gap-2">
      {WORDS.map((w, i) => (
        <motion.span
          key={w}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 * i }}
          className={`rounded-full px-4 py-2 text-lg font-extrabold ${i % 3 === 0 ? "bg-ivory text-bg" : i % 3 === 1 ? "bg-surface" : "bg-gold text-bg"}`}
        >
          {w}
        </motion.span>
      ))}
    </div>
  );
}

function MockQuestion() {
  return (
    <div className="w-full max-w-xs rounded-3xl bg-surface p-5">
      <p className="text-lg font-extrabold">Which print is this?</p>
      <VisualTile v={{ kind: "pattern", material: { id: "houndstooth", main: "#efe9dd", accent: "#161514", scale: 1.8 } }} className="mx-auto mt-4 aspect-square w-32" />
      <div className="mt-4 space-y-2">
        {["Houndstooth", "Gingham", "Pinstripe"].map((o, i) => (
          <div key={o} className={`rounded-xl border-2 px-4 py-2.5 font-bold ${i === 0 ? "border-[#5fd08a] bg-[#5fd08a]/15" : "border-line"}`}>
            {o}
          </div>
        ))}
      </div>
    </div>
  );
}

function MockStreak() {
  return (
    <div className="flex flex-col items-center">
      <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.8, repeat: Infinity }}>
        <Flame className="h-32 w-32 text-[#ff8a3d]" />
      </motion.div>
      <p className="headline mt-2 text-5xl">12 days</p>
      <p className="mt-3 flex items-center gap-2 text-xl font-extrabold text-gold">
        <Bolt className="h-6 w-6" /> +15 XP
      </p>
    </div>
  );
}

function MockDuel() {
  return (
    <div className="w-full max-w-xs rounded-3xl bg-surface p-5">
      <p className="eyebrow">Duel · 7 questions</p>
      <div className="mt-4 flex items-center justify-between">
        <div className="text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ivory text-xl font-black text-bg">YOU</span>
          <p className="mt-2 text-3xl font-extrabold">6</p>
        </div>
        <span className="font-mono text-muted">vs</span>
        <div className="text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gold text-xl font-black text-bg">AM</span>
          <p className="mt-2 text-3xl font-extrabold">4</p>
        </div>
      </div>
      <p className="mt-4 rounded-xl bg-[#5fd08a]/15 py-2 text-center font-extrabold text-[#5fd08a]">You won · +20 XP</p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.6 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.2-8.5 2.2-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
