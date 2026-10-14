"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FeedMode, FeedResponse, Video } from "@/lib/types";
import { Player } from "./Player";
import { rememberTopic } from "./recentTopics";

/** Una sessione ha una fine: dopo SESSION_SIZE video ti fermiamo e ti chiediamo se continuare. */
const SESSION_SIZE = 12;
/** Quanti video prima della fine iniziamo a caricare i successivi. */
const PREFETCH_AHEAD = 4;
const MAX_EMPTY_PAGES = 3;

type Slide = { kind: "video"; video: Video } | { kind: "end"; reason: "goal" | "exhausted" };

export function Feed({ topic }: { topic: string }) {
  const [items, setItems] = useState<Video[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<FeedMode | null>(null);
  const [label, setLabel] = useState(topic);
  const [notice, setNotice] = useState<{ text: string; suggestions: string[] } | null>(null);

  const [goal, setGoal] = useState(SESSION_SIZE);
  const [active, setActive] = useState(0);
  const [watched, setWatched] = useState(0);
  const [muted, setMuted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());

  const scrollerRef = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<string>());
  const blockedChannels = useRef(new Set<string>());
  const inflight = useRef(false);
  /** Pagine di fila senza video nuovi: oltre MAX_EMPTY_PAGES smettiamo di cercare (e di consumare quota). */
  const emptyPages = useRef(0);

  const load = useCallback(
    async (nextCursor: string | null) => {
      if (inflight.current) return;
      inflight.current = true;
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ topic });
        if (nextCursor) qs.set("cursor", nextCursor);
        const res = await fetch(`/api/feed?${qs}`);
        const data = (await res.json()) as FeedResponse & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Errore nel caricamento");

        setMode(data.mode);
        setLabel(data.topic);
        if (data.notice) setNotice({ text: data.notice, suggestions: data.suggestions ?? [] });
        const fresh = data.items.filter(
          (v) => !seen.current.has(v.id) && !blockedChannels.current.has(v.channel),
        );
        fresh.forEach((v) => seen.current.add(v.id));
        setItems((prev) => [...prev, ...fresh]);
        emptyPages.current = fresh.length === 0 ? emptyPages.current + 1 : 0;
        setCursor(data.cursor);
        setHasMore(data.cursor !== null && emptyPages.current < MAX_EMPTY_PAGES);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore nel caricamento");
      } finally {
        inflight.current = false;
        setLoading(false);
      }
    },
    [topic],
  );

  useEffect(() => {
    rememberTopic(topic);
    void load(null);
  }, [topic, load]);

  // Carica altri video quando ci avviciniamo alla fine di quelli disponibili.
  useEffect(() => {
    if (!hasMore || loading || error) return;
    const visible = Math.min(items.length, goal);
    if (items.length < goal && active >= visible - PREFETCH_AHEAD) void load(cursor);
  }, [active, items.length, goal, hasMore, loading, error, cursor, load]);

  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = items.slice(0, goal).map((video) => ({ kind: "video", video }));
    if (items.length >= goal) list.push({ kind: "end", reason: "goal" });
    else if (!hasMore && !loading && items.length > 0) list.push({ kind: "end", reason: "exhausted" });
    return list;
  }, [items, goal, hasMore, loading]);

  // Quale slide è a schermo.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const index = Number(el.dataset.index);
            setActive(index);
            if (el.dataset.kind === "video") setWatched((w) => Math.max(w, Math.min(index + 1, goal)));
          }
        }
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [slides, goal]);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 2600);
  }, []);

  const removeVideo = useCallback((id: string) => {
    setItems((prev) => prev.filter((v) => v.id !== id));
  }, []);

  function offTopic(video: Video) {
    if (video.channel) {
      blockedChannels.current.add(video.channel);
      setItems((prev) => prev.filter((v) => v.id === video.id || v.channel !== video.channel));
      showToast(`Ok, niente più video di ${video.channel} in questa sessione`);
    } else {
      showToast("Ok, tolto dal feed");
    }
    removeVideo(video.id);
  }

  function continueSession() {
    setGoal((g) => g + SESSION_SIZE);
  }

  const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
  const activeSlide = slides[active];

  return (
    <div className="feed-shell">
      <header className="feed-top">
        <Link href="/" className="icon-btn" aria-label="Cambia argomento">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="feed-title">
          <span className="feed-topic">{label}</span>
          {mode === "demo" && <span className="chip-demo">demo</span>}
        </div>
        <div className="feed-count" aria-label={`Video ${Math.min(watched, goal)} di ${goal}`}>
          {Math.min(watched, goal)}/{goal}
        </div>
        <div className="progress" aria-hidden>
          <div className="progress-bar" style={{ width: `${(Math.min(watched, goal) / goal) * 100}%` }} />
        </div>
      </header>

      <div className="feed" ref={scrollerRef}>
        {slides.map((slide, index) =>
          slide.kind === "video" ? (
            <section className="slide" key={slide.video.id} data-index={index} data-kind="video">
              <VideoSlide
                video={slide.video}
                isActive={index === active}
                isNear={Math.abs(index - active) <= 2}
                muted={muted}
                onAutoMuted={() => setMuted(true)}
                onUnavailable={() => removeVideo(slide.video.id)}
                onToggleMute={() => setMuted((m) => !m)}
                onOffTopic={() => offTopic(slide.video)}
              />
            </section>
          ) : (
            <section className="slide" key={`end-${goal}`} data-index={index} data-kind="end">
              <EndCard
                reason={slide.reason}
                topic={label}
                count={Math.min(watched, items.length)}
                minutes={minutes}
                onContinue={continueSession}
              />
            </section>
          ),
        )}

        {slides.length === 0 && (
          <section className="slide">
            <div className="state-card">
              {error ? (
                <>
                  <p className="state-title">Ops.</p>
                  <p className="state-text">{error}</p>
                  <button type="button" className="btn-primary" onClick={() => load(cursor)}>
                    Riprova
                  </button>
                </>
              ) : notice ? (
                <>
                  <p className="state-title">“{topic}” non è ancora nella demo</p>
                  <p className="state-text">{notice.text}</p>
                  <div className="chips">
                    {notice.suggestions.map((s) => (
                      <Link key={s} className="chip" href={`/feed?t=${encodeURIComponent(s)}`}>
                        {s}
                      </Link>
                    ))}
                  </div>
                </>
              ) : !loading && !hasMore ? (
                <>
                  <p className="state-title">Nessun video trovato</p>
                  <p className="state-text">Prova a scrivere l'argomento in un altro modo.</p>
                  <Link className="btn-primary" href="/">
                    Cambia argomento
                  </Link>
                </>
              ) : (
                <>
                  <div className="spinner" aria-hidden />
                  <p className="state-title">Sto preparando il tuo feed</p>
                  <p className="state-text">Cerco video brevi su “{topic}” e scarto quelli fuori tema.</p>
                </>
              )}
            </div>
          </section>
        )}

        {slides.length > 0 && loading && items.length < goal && (
          <section className="slide">
            <div className="state-card">
              <div className="spinner" aria-hidden />
              <p className="state-text">Carico altri video…</p>
            </div>
          </section>
        )}

        {slides.length > 0 && activeSlide?.kind === "video" && error && (
          <div className="inline-error">
            {error}{" "}
            <button type="button" onClick={() => load(cursor)}>
              Riprova
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function VideoSlide({
  video,
  isActive,
  isNear,
  muted,
  onAutoMuted,
  onUnavailable,
  onToggleMute,
  onOffTopic,
}: {
  video: Video;
  isActive: boolean;
  isNear: boolean;
  muted: boolean;
  onAutoMuted: () => void;
  onUnavailable: () => void;
  onToggleMute: () => void;
  onOffTopic: () => void;
}) {
  return (
    <div className="video">
      {isNear && (
        <>
          <img className="video-bg" src={video.thumbnail} alt="" aria-hidden />
          <img className="video-thumb" src={video.thumbnail} alt="" aria-hidden />
        </>
      )}
      {isActive && (
        <Player videoId={video.id} muted={muted} onAutoMuted={onAutoMuted} onUnavailable={onUnavailable} />
      )}

      <div className="video-info">
        {video.channel && <p className="video-channel">@{video.channel}</p>}
        <p className="video-title">{video.title}</p>
        {video.reason && (
          <p className="video-reason">
            <span aria-hidden>✦</span> {video.reason}
          </p>
        )}
      </div>

      <div className="rail">
        <button type="button" className="rail-btn" onClick={onToggleMute} aria-label={muted ? "Attiva audio" : "Disattiva audio"}>
          {muted ? (
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
              <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
              <path d="M17 9l5 6M22 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
              <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
              <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          )}
          <span>{muted ? "Audio" : "Muto"}</span>
        </button>
        <button type="button" className="rail-btn" onClick={onOffTopic} aria-label="Fuori tema, toglilo">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Fuori tema</span>
        </button>
        <a
          className="rail-btn"
          href={`https://www.youtube.com/shorts/${video.id}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Apri su YouTube"
        >
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
            <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>YouTube</span>
        </a>
      </div>

      {isActive && muted && (
        <button type="button" className="unmute-pill" onClick={onToggleMute}>
          Tocca per l'audio
        </button>
      )}
    </div>
  );
}

function EndCard({
  reason,
  topic,
  count,
  minutes,
  onContinue,
}: {
  reason: "goal" | "exhausted";
  topic: string;
  count: number;
  minutes: number;
  onContinue: () => void;
}) {
  return (
    <div className="state-card end-card">
      <div className="end-check" aria-hidden>
        ✓
      </div>
      <p className="state-title">{reason === "goal" ? "Sessione completata" : "Hai visto tutto, per ora"}</p>
      <p className="state-text">
        {count} video su <strong>{topic}</strong> in circa {minutes} {minutes === 1 ? "minuto" : "minuti"}.
        {reason === "goal" ? " Ti fermi qui o ne vuoi altri?" : " Prova un argomento vicino per andare più a fondo."}
      </p>
      <div className="end-actions">
        {reason === "goal" && (
          <button type="button" className="btn-primary" onClick={onContinue}>
            Altri {SESSION_SIZE} video
          </button>
        )}
        <Link className={reason === "goal" ? "btn-ghost" : "btn-primary"} href="/">
          Cambia argomento
        </Link>
      </div>
    </div>
  );
}
