"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { INTRO, INTRO_CTA } from "@/content/intro";
import type { CardView } from "@/lib/cards/view";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PackArt } from "./PackArt";
import { DOWN, TrendCard, UP } from "./TrendCard";
import { Wordmark } from "./Wordmark";

/** Full-screen intro, swipe through 5 screens, then sign in with Google. */
export function Intro({ cards }: { cards: CardView[] }) {
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
              {s.kind === "cards" && <FannedCards cards={cards} />}
              {s.kind === "pack" && (
                <motion.div animate={{ rotate: [-3, 3, -3], y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="w-[46vw] max-w-[220px]">
                  <PackArt />
                </motion.div>
              )}
              {s.kind === "market" && <MiniMarket cards={cards} />}
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

function FannedCards({ cards }: { cards: CardView[] }) {
  return (
    <div className="relative h-[62vw] max-h-[340px] w-full max-w-sm">
      {cards.slice(0, 3).map((c, i) => (
        <motion.div
          key={c.trendId}
          className="absolute top-0 w-[40vw] max-w-[200px]"
          style={{ left: `calc(50% - min(20vw, 100px) + ${(i - 1) * 28}%)`, zIndex: i === 1 ? 2 : 1, transformOrigin: "50% 110%" }}
          animate={{ rotate: [(i - 1) * 12 - 2, (i - 1) * 12 + 2, (i - 1) * 12 - 2] }}
          transition={{ duration: 7 + i, repeat: Infinity, ease: "easeInOut" }}
        >
          <TrendCard card={c} />
        </motion.div>
      ))}
    </div>
  );
}

function MiniMarket({ cards }: { cards: CardView[] }) {
  return (
    <div className="w-full max-w-sm rounded-3xl bg-surface p-5">
      <p className="eyebrow">Live now</p>
      <ul className="mt-3 divide-y divide-line">
        {cards.map((c) => {
          const ch = c.dayOpen ? c.value / c.dayOpen - 1 : 0;
          return (
            <li key={c.trendId} className="flex items-center justify-between py-3">
              <span className="text-lg font-extrabold">{c.name}</span>
              <span className="font-extrabold tabular-nums" style={{ color: ch >= 0 ? UP : DOWN }}>
                {ch >= 0 ? "▲" : "▼"} {Math.abs(ch * 100).toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
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
