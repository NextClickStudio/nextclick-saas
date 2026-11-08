"use client";

// A small film engine for the home: each film is a function of time (seconds) drawn on a fixed 1280×800 stage that is
// scaled to the screen, so it reads like a video at any size and stays sharp. The player plays the films in a row
// while it is on screen, with chapters to jump to, a progress bar that can be scrubbed, play and pause.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export const W = 1280;
export const H = 800;

// ---- timing ------------------------------------------------------------------------------------------------------
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lin = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
/** ease out, fast then settling: for things arriving */
export const out = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
/** ease in and out: for things travelling */
export const io = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** a little past the mark and back: for things that land */
export const back = (x: number) => {
  const c = 1.55;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};
/** 0 → 1 between two times, eased */
export const k = (t: number, a: number, b: number, e: (x: number) => number = out) => e(lin(t, a, b));
export const mix = (a: number, b: number, x: number) => a + (b - a) * x;

/** a box placed on the stage */
export function at(x: number, y: number, extra?: CSSProperties): CSSProperties {
  return { position: "absolute", left: x, top: y, ...extra };
}

// ---- the player --------------------------------------------------------------------------------------------------
export type Film = {
  id: string;
  title: string;
  /** one line under the title */
  line: string;
  duration: number;
  chapters: { at: number; label: string }[];
  /** the subtitle at time t, drawn by the player at reading size (not scaled with the stage) */
  caption: (t: number) => string;
  Scene: (p: { t: number }) => ReactNode;
};

export function Player({ films }: { films: Film[] }) {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [fi, setFi] = useState(0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const reduce = useRef(false);
  const film = films[fi];

  // the stage fits its box
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // plays only while on screen
  useEffect(() => {
    reduce.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce.current) setPlaying(false);
    const el = box.current;
    if (!el) return;
    const ob = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  // the clock
  useEffect(() => {
    if (!playing || !visible) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setT((v) => Math.min(film.duration, v + dt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, visible, film.duration, films.length]);
  // at the end of a film the next one starts from its first frame
  useEffect(() => {
    if (t < film.duration) return;
    setFi((f) => (f + 1) % films.length);
    setT(0);
  }, [t, film.duration, films.length]);
  // with reduced motion each film rests on its last frame
  const shownT = reduce.current && !playing ? film.duration - 0.01 : t;

  const go = useCallback((i: number, at = 0) => {
    setFi(i);
    setT(at);
  }, []);
  const scrub = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setT(clamp((e.clientX - r.left) / r.width) * film.duration * 0.999);
  };
  const chapterAt = film.chapters.reduce((a, c, i) => (shownT >= c.at ? i : a), 0);

  return (
    <div className="fp" ref={box}>
      <div className="fp-tabs" role="tablist" aria-label="How yeppo works, in films">
        {films.map((f, i) => (
          <button key={f.id} type="button" role="tab" aria-selected={i === fi} className={i === fi ? "on" : ""} onClick={() => go(i)}>
            <i>{String(i + 1).padStart(2, "0")}</i>
            <span>{f.title}</span>
            <em style={{ transform: `scaleX(${i === fi ? shownT / f.duration : i < fi ? 1 : 0})` }} />
          </button>
        ))}
      </div>
      <div className="fp-stage" ref={stage} onClick={() => setPlaying((p) => !p)} role="img" aria-label={`${film.title}: ${film.line}`}>
        <div className="fp-canvas" style={{ width: W, height: H, transform: `scale(${scale})` }}>
          <film.Scene t={shownT} />
        </div>
        {film.caption(shownT) && (
          <span key={film.caption(shownT)} className="fp-cap">
            {film.caption(shownT)}
          </span>
        )}
        {!playing && (
          <span className="fp-paused" aria-hidden>
            <i />
            <i />
          </span>
        )}
      </div>
      <div className="fp-bar">
        <button type="button" className="fp-play" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying((p) => !p)}>
          {playing ? (
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <rect x="3" y="2" width="3.4" height="12" fill="currentColor" />
              <rect x="9.6" y="2" width="3.4" height="12" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <path d="M4 2 L14 8 L4 14 Z" fill="currentColor" />
            </svg>
          )}
        </button>
        <div className="fp-chapters" onPointerDown={scrub}>
          {film.chapters.map((c, i) => {
            const end = film.chapters[i + 1]?.at ?? film.duration;
            const fill = clamp((shownT - c.at) / (end - c.at));
            return (
              <div key={c.label} className={`fp-ch ${i === chapterAt ? "on" : ""}`} style={{ flexGrow: end - c.at }}>
                <span>{c.label}</span>
                <b>
                  <em style={{ transform: `scaleX(${fill})` }} />
                </b>
              </div>
            );
          })}
        </div>
        <span className="fp-time">
          {shownT.toFixed(1).padStart(4, "0")}s / {film.duration}s
        </span>
      </div>
      <p className="fp-line">{film.line}</p>
    </div>
  );
}
