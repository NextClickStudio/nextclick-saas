"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getLanguage } from "@/lib/languages";
import type { StepResponse } from "@/lib/paths";
import type { Video } from "@/lib/types";
import { dayKey, levelFor, liveStreak, XP, type XpKind } from "@/lib/xp";
import { Confetti } from "./Confetti";
import { MissingPath } from "./PathOverview";
import { getPath, nextTodo, savePath, type SavedPath } from "./paths";
import { buzz, earn, useStats } from "./stats";
import { VideoSlide } from "./VideoSlide";

type Slide =
  | { kind: "intro"; step: number }
  | { kind: "video"; step: number; index: number; video: Video }
  | { kind: "loading"; step: number }
  | { kind: "done"; step: number; next: number }
  | { kind: "finish" };

function slideKey(s: Slide): string {
  if (s.kind === "video") return `v-${s.step}-${s.video.id}`;
  if (s.kind === "finish") return "finish";
  return `${s.kind}-${s.step}`;
}

/**
 * Il percorso, un passo alla volta: scheda del passo → video in ordine → "passo completato".
 * Ogni movimento salva dove sei arrivato, così riprendi esattamente da lì.
 */
export function PathPlayer({ id }: { id: string }) {
  const router = useRouter();
  const [path, setPath] = useState<SavedPath | null | undefined>(undefined);
  const pathRef = useRef<SavedPath | null>(null);
  const startStep = useRef<number>(0);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [, setLoadingTick] = useState(0);
  const loading = useRef(new Set<number>());
  const blocked = useRef(new Set<string>());
  const scrollerRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);
  /** Ultima scheda attivata: l'observer viene ricreato a ogni salvataggio, non vogliamo riattivarla. */
  const lastActivated = useRef<string | null>(null);
  const stats = useStats();
  const [pops, setPops] = useState<Array<{ id: number; text: string }>>([]);
  const [levelUp, setLevelUp] = useState<{ level: number; title: string } | null>(null);
  /** Ricompense già date in questa visita (video, passi, percorso). */
  const rewarded = useRef(new Set<string>());
  const popId = useRef(0);

  useEffect(() => {
    const p = getPath(id);
    if (p) {
      startStep.current = p.position.step;
      pathRef.current = p;
    }
    setPath(p);
  }, [id]);

  const commit = useCallback((update: (p: SavedPath) => SavedPath) => {
    const cur = pathRef.current;
    if (!cur) return;
    const next = savePath(update(cur));
    pathRef.current = next;
    setPath(next);
  }, []);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 2600);
  }, []);

  const reward = useCallback((kind: XpKind, key: string) => {
    if (rewarded.current.has(key)) return;
    rewarded.current.add(key);
    const gain = earn(kind);
    // Passi e percorso mostrano i punti sulla loro scheda; i video con un "+10 XP" volante.
    if (kind === "video") {
      const id = ++popId.current;
      setPops((list) => [...list, { id, text: `+${gain.amount} XP` }]);
      window.setTimeout(() => setPops((list) => list.filter((x) => x.id !== id)), 1300);
    }
    if (gain.levelUp) {
      const { level, title } = levelFor(gain.stats.xp);
      setLevelUp({ level, title });
      window.setTimeout(() => setLevelUp((l) => (l?.level === level ? null : l)), 2600);
      buzz([30, 60, 30, 60, 90]);
    } else {
      buzz(kind === "video" ? 10 : [25, 50, 25]);
    }
  }, []);

  const ensureLoaded = useCallback(
    async (i: number) => {
      const p = pathRef.current;
      if (!p || i < 0 || i >= p.steps.length) return;
      const step = p.steps[i];
      if (step.videos !== undefined || loading.current.has(i)) return;
      if (step.queries.length === 0) {
        commit((cur) => ({ ...cur, steps: cur.steps.map((s, k) => (k === i ? { ...s, videos: [] } : s)) }));
        return;
      }
      loading.current.add(i);
      setLoadingTick((t) => t + 1);
      setErrors((e) => {
        const { [i]: _drop, ...rest } = e;
        return rest;
      });
      try {
        const seen = new Set(p.steps.flatMap((s) => s.videos ?? []).map((v) => v.id));
        let cursor: string | undefined = step.cursor ?? undefined;
        const items: Video[] = [];
        for (let attempt = 0; attempt < 2 && items.length < 3; attempt++) {
          const res = await fetch("/api/step", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ topic: p.topic, step: step.title, queries: step.queries, lang: p.lang, cursor }),
          });
          const data = (await res.json()) as StepResponse & { error?: string };
          if (!res.ok) throw new Error(data.error ?? "Couldn't load this step");
          for (const v of data.items) {
            if (seen.has(v.id) || blocked.current.has(v.channel)) continue;
            seen.add(v.id);
            items.push(v);
          }
          cursor = data.cursor ?? undefined;
          if (!data.cursor) break;
        }
        commit((cur) => ({
          ...cur,
          steps: cur.steps.map((s, k) => (k === i ? { ...s, videos: items.slice(0, 5), cursor: cursor ?? null } : s)),
        }));
      } catch (e) {
        setErrors((prev) => ({ ...prev, [i]: e instanceof Error ? e.message : "Couldn't load this step" }));
      } finally {
        loading.current.delete(i);
        setLoadingTick((t) => t + 1);
      }
    },
    [commit],
  );

  const slides = useMemo<Slide[]>(() => {
    if (!path) return [];
    const list: Slide[] = [];
    const start = startStep.current;
    for (let i = start; i < path.steps.length; i++) {
      const s = path.steps[i];
      if (s.status === "known" && i !== start) continue;
      list.push({ kind: "intro", step: i });
      if (s.videos === undefined) {
        list.push({ kind: "loading", step: i });
        return list;
      }
      s.videos.forEach((video, index) => list.push({ kind: "video", step: i, index, video }));
      list.push({ kind: "done", step: i, next: nextTodo(path, i + 1) });
    }
    list.push({ kind: "finish" });
    return list;
  }, [path]);

  // Riprendi esattamente da dove eri rimasto.
  useLayoutEffect(() => {
    const root = scrollerRef.current;
    if (!path || !root || didInitialScroll.current || slides.length === 0) return;
    didInitialScroll.current = true;
    const { step, video } = path.position;
    let index = slides.findIndex((s) =>
      video >= 0 ? s.kind === "video" && s.step === step && s.index === video : s.kind === "intro" && s.step === step,
    );
    if (index < 0) index = 0;
    root.scrollTop = index * root.clientHeight;
    setActive(index);
  }, [path, slides]);

  const onActivate = useCallback(
    (slide: Slide) => {
      const p = pathRef.current;
      if (!p) return;
      switch (slide.kind) {
        case "intro":
          commit((cur) => ({ ...cur, position: { step: slide.step, video: -1 }, finished: false }));
          void ensureLoaded(slide.step);
          break;
        case "video": {
          const firstTime = slide.index > (p.steps[slide.step].seen ?? -1);
          commit((cur) => ({
            ...cur,
            position: { step: slide.step, video: slide.index },
            finished: false,
            steps: firstTime
              ? cur.steps.map((s, k) => (k === slide.step ? { ...s, seen: slide.index } : s))
              : cur.steps,
          }));
          if (firstTime) reward("video", `v-${slide.step}-${slide.video.id}`);
          const count = p.steps[slide.step].videos?.length ?? 0;
          if (slide.index >= count - 2) void ensureLoaded(nextTodo(p, slide.step + 1));
          break;
        }
        case "done": {
          const wasDone = p.steps[slide.step].status === "done";
          const wasFinished = p.finished;
          commit((cur) => {
            const steps = cur.steps.map((s, k) => (k === slide.step ? { ...s, status: "done" as const } : s));
            const next = nextTodo({ ...cur, steps }, slide.step + 1);
            return {
              ...cur,
              steps,
              position: next === -1 ? cur.position : { step: next, video: -1 },
              finished: next === -1,
            };
          });
          if (!wasDone) reward("step", `s-${slide.step}`);
          if (!wasFinished && pathRef.current?.finished) window.setTimeout(() => reward("path", "path"), 700);
          if (slide.next >= 0) void ensureLoaded(slide.next);
          break;
        }
        case "loading":
          void ensureLoaded(slide.step);
          break;
        case "finish":
          commit((cur) => ({ ...cur, finished: true }));
          break;
      }
    },
    [commit, ensureLoaded, reward],
  );

  // Quale scheda è a schermo.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.index);
          setActive(index);
          const slide = slides[index];
          if (!slide || lastActivated.current === slideKey(slide)) continue;
          lastActivated.current = slideKey(slide);
          onActivate(slide);
        }
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [slides, onActivate]);

  if (path === undefined) return <div className="feed-shell" />;
  if (path === null) return <MissingPath />;

  const total = path.steps.length;
  const activeSlide = slides[active];
  const activeStep = activeSlide && "step" in activeSlide ? activeSlide.step : path.position.step;
  const language = getLanguage(path.lang);
  const xp = stats?.xp ?? 0;
  const level = levelFor(xp);
  const streak = stats ? liveStreak(stats, dayKey(new Date())) : 0;

  function removeVideo(step: number, videoId: string, channel?: string) {
    if (channel) blocked.current.add(channel);
    commit((cur) => ({
      ...cur,
      steps: cur.steps.map((s, k) => (k === step ? { ...s, videos: (s.videos ?? []).filter((v) => v.id !== videoId) } : s)),
    }));
  }

  function next() {
    const root = scrollerRef.current;
    root?.scrollBy({ top: root.clientHeight, behavior: "smooth" });
  }

  return (
    <div className="feed-shell">
      <header className="feed-top">
        <Link href={`/path/${path.id}`} className="icon-btn" aria-label="Path map">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="feed-title">
          <span className="feed-topic">{path.title}</span>
          <span className="feed-lang" title={language.label}>
            {language.flag}
          </span>
          {path.mode === "demo" && <span className="chip-demo">demo</span>}
        </div>
        <span className="xp-chip" key={xp} aria-label={`${xp} XP`}>
          ⚡ {xp}
        </span>
        <div className="feed-count" aria-label={`Step ${activeStep + 1} of ${total}`}>
          {Math.min(activeStep + 1, total)}/{total}
        </div>
        <div className="seg-progress" aria-hidden>
          {path.steps.map((s, i) => {
            const vids = s.videos?.length ?? 0;
            const fill =
              s.status === "done" || s.status === "known"
                ? 1
                : i === activeStep && activeSlide?.kind === "video"
                  ? (activeSlide.index + 1) / Math.max(1, vids)
                  : 0;
            return (
              <span key={i} className={`seg ${s.status === "known" ? "seg-known" : ""}`}>
                <span className="seg-fill" style={{ width: `${fill * 100}%` }} />
              </span>
            );
          })}
        </div>
      </header>

      <div className="feed" ref={scrollerRef}>
        {slides.map((slide, index) => {
          const key = slideKey(slide);
          if (slide.kind === "video") {
            const v = slide.video;
            return (
              <section className="slide" key={key} data-index={index}>
                <VideoSlide
                  video={v}
                  isActive={index === active}
                  isNear={Math.abs(index - active) <= 2}
                  muted={muted}
                  onAutoMuted={() => setMuted(true)}
                  onUnavailable={() => removeVideo(slide.step, v.id)}
                  onToggleMute={() => setMuted((m) => !m)}
                  onOffTopic={() => {
                    removeVideo(slide.step, v.id, v.channel || undefined);
                    showToast(v.channel ? `Got it. No more videos from ${v.channel}.` : "Got it. Removed from your path.");
                  }}
                />
              </section>
            );
          }
          if (slide.kind === "intro") {
            const s = path.steps[slide.step];
            const count = s.videos?.length;
            return (
              <section className={`slide step-slide tone-${slide.step % 6}`} key={key} data-index={index}>
                <div className="step-intro">
                  <p className="step-kicker">
                    Step {slide.step + 1} of {total}
                  </p>
                  <h2 className="step-title">{s.title}</h2>
                  <p className="step-summary">{s.summary}</p>
                  <div className="step-chips">
                    {count !== undefined ? (
                      <span>
                        ▶ {count} {count === 1 ? "video" : "videos"}
                      </span>
                    ) : (
                      <span>Finding the best videos…</span>
                    )}
                    <span className="chip-xp">+{(count ?? 3) * XP.video + XP.step} XP</span>
                    {s.status === "done" && <span>✓ Done before</span>}
                  </div>
                  <button type="button" className="swipe-hint" onClick={next}>
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
                      <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Swipe up to start
                  </button>
                </div>
              </section>
            );
          }
          if (slide.kind === "loading") {
            const err = errors[slide.step];
            return (
              <section className="slide" key={key} data-index={index}>
                <div className="state-card">
                  {err ? (
                    <>
                      <p className="state-emoji" aria-hidden>
                        🛰️
                      </p>
                      <p className="state-title">Lost the signal</p>
                      <p className="state-text">{err}</p>
                      <button type="button" className="btn btn-volt" onClick={() => ensureLoaded(slide.step)}>
                        Try again
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="scan" aria-hidden>
                        <span />
                      </div>
                      <p className="state-title">Lining up step {slide.step + 1}</p>
                      <p className="state-text">
                        Finding short videos for &ldquo;{path.steps[slide.step].title}&rdquo; and skipping anything
                        off-topic.
                      </p>
                    </>
                  )}
                </div>
              </section>
            );
          }
          if (slide.kind === "done") {
            const s = path.steps[slide.step];
            const nextStep = slide.next >= 0 ? path.steps[slide.next] : null;
            const doneCount = path.steps.filter((x) => x.status === "done" || x.status === "known").length;
            return (
              <section className="slide" key={key} data-index={index}>
                <div className="state-card end-card cleared">
                  {index === active && <Confetti />}
                  <p className="cleared-kicker">Step {slide.step + 1} cleared</p>
                  <p className="cleared-title">{s.title}</p>
                  {rewarded.current.has(`s-${slide.step}`) && <p className="xp-burst">+{XP.step} XP</p>}
                  {(s.videos?.length ?? 0) === 0 && (
                    <p className="state-text">We couldn&apos;t find great videos for this step yet, so we skipped it.</p>
                  )}
                  <StatsLine streak={streak} level={level} />
                  <p className="state-text">
                    {doneCount} of {total} steps behind you. Your progress is saved.
                  </p>
                  {nextStep && (
                    <div className="up-next">
                      <span className="up-next-label">Up next · Step {slide.next + 1}</span>
                      <span className="up-next-title">{nextStep.title}</span>
                      <span className="up-next-summary">{nextStep.summary}</span>
                    </div>
                  )}
                  <div className="end-actions">
                    {nextStep && (
                      <button type="button" className="btn btn-volt" onClick={next}>
                        Next step →
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => router.push(`/path/${path.id}`)}
                    >
                      Stop for now
                    </button>
                  </div>
                </div>
              </section>
            );
          }
          return (
            <section className="slide" key={key} data-index={index}>
              <div className="state-card end-card cleared">
                {index === active && <Confetti count={48} />}
                <p className="trophy" aria-hidden>
                  🏆
                </p>
                <p className="cleared-kicker">Path complete</p>
                <p className="cleared-title">{path.title}</p>
                {rewarded.current.has("path") && <p className="xp-burst">+{XP.path} XP bonus</p>}
                <StatsLine streak={streak} level={level} />
                <p className="state-text">All {total} steps done. Time to practise what you learned.</p>
                <div className="end-actions">
                  <Link className="btn btn-volt" href="/learn">
                    Start a new path
                  </Link>
                  <Link className="btn btn-ghost" href="/library">
                    Back to library
                  </Link>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      <div className="xp-pops" aria-live="polite">
        {pops.map((pop) => (
          <span key={pop.id} className="xp-pop">
            {pop.text}
          </span>
        ))}
      </div>

      {levelUp && (
        <div className="levelup" role="status">
          <span className="levelup-kicker">Level up</span>
          <strong className="levelup-num">{levelUp.level}</strong>
          <span className="levelup-title">{levelUp.title}</span>
        </div>
      )}
    </div>
  );
}

function StatsLine({ streak, level }: { streak: number; level: ReturnType<typeof levelFor> }) {
  return (
    <div className="cleared-stats">
      <div className="cleared-chips">
        <span>🔥 {streak}-day streak</span>
        <span>
          ⚡ LVL {level.level} · {level.title}
        </span>
      </div>
      <span className="lvl-bar lvl-bar-lg" aria-label={`${level.into} of ${level.span} XP to the next level`}>
        <span style={{ width: `${level.ratio * 100}%` }} />
      </span>
    </div>
  );
}
