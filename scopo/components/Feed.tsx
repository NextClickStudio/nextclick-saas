"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { feedHref, getLanguage, type LangCode } from "@/lib/languages";
import type { FeedMode, FeedResponse, Video } from "@/lib/types";
import { Player } from "./Player";
import { rememberTopic } from "./prefs";

/** A session has an end: after SESSION_SIZE videos we stop and ask. */
const SESSION_SIZE = 12;
/** Start loading more this many videos before the end. */
const PREFETCH_AHEAD = 4;
/** Pages in a row with nothing new: after this we stop searching (and spending quota). */
const MAX_EMPTY_PAGES = 3;

type Slide = { kind: "video"; video: Video } | { kind: "end"; reason: "goal" | "exhausted" };

export function Feed({ topic, lang }: { topic: string; lang: LangCode }) {
  const [items, setItems] = useState<Video[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<FeedMode | null>(null);
  const [label, setLabel] = useState(topic);
  const [feedLang, setFeedLang] = useState<LangCode>(lang);
  const [notice, setNotice] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<FeedResponse["suggestions"]>([]);

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
  const emptyPages = useRef(0);

  const load = useCallback(
    async (nextCursor: string | null) => {
      if (inflight.current) return;
      inflight.current = true;
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ topic, lang });
        if (nextCursor) qs.set("cursor", nextCursor);
        const res = await fetch(`/api/feed?${qs}`);
        const data = (await res.json()) as FeedResponse & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Couldn't load videos");

        setMode(data.mode);
        setLabel(data.topic);
        setFeedLang(data.lang);
        setNotice(data.notice ?? null);
        setSuggestions(data.suggestions ?? []);
        const fresh = data.items.filter(
          (v) => !seen.current.has(v.id) && !blockedChannels.current.has(v.channel),
        );
        fresh.forEach((v) => seen.current.add(v.id));
        setItems((prev) => [...prev, ...fresh]);
        emptyPages.current = fresh.length === 0 ? emptyPages.current + 1 : 0;
        setCursor(data.cursor);
        setHasMore(data.cursor !== null && emptyPages.current < MAX_EMPTY_PAGES);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load videos");
      } finally {
        inflight.current = false;
        setLoading(false);
      }
    },
    [topic, lang],
  );

  useEffect(() => {
    rememberTopic(topic, lang);
    void load(null);
  }, [topic, lang, load]);

  // Load more as we get close to the end of what we have.
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

  // Which slide is on screen.
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
      showToast(`Got it. No more videos from ${video.channel} this session.`);
    } else {
      showToast("Got it. Removed from your feed.");
    }
    removeVideo(video.id);
  }

  const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
  const activeSlide = slides[active];
  const language = getLanguage(feedLang);
  const progress = Math.min(watched, goal);

  return (
    <div className="feed-shell">
      <header className="feed-top">
        <Link href="/learn" className="icon-btn" aria-label="Change topic">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="feed-title">
          <span className="feed-topic">{label}</span>
          <span className="feed-lang" title={language.label}>
            {language.flag}
          </span>
          {mode === "demo" && <span className="chip-demo">demo</span>}
        </div>
        <div className="feed-count" aria-label={`Video ${progress} of ${goal}`}>
          {progress}/{goal}
        </div>
        <div className="progress" aria-hidden>
          <div className="progress-bar" style={{ width: `${(progress / goal) * 100}%` }} />
        </div>
      </header>

      {notice && items.length > 0 && <div className="feed-notice">{notice}</div>}

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
                onContinue={() => setGoal((g) => g + SESSION_SIZE)}
              />
            </section>
          ),
        )}

        {slides.length === 0 && (
          <section className="slide">
            <div className="state-card">
              {error ? (
                <>
                  <p className="state-emoji" aria-hidden>
                    🛰️
                  </p>
                  <p className="state-title">Lost the signal.</p>
                  <p className="state-text">{error}</p>
                  <button type="button" className="btn btn-volt" onClick={() => load(cursor)}>
                    Try again
                  </button>
                </>
              ) : notice && !loading ? (
                <>
                  <p className="state-emoji" aria-hidden>
                    🧭
                  </p>
                  <p className="state-title">&ldquo;{topic}&rdquo; isn&apos;t in the demo yet</p>
                  <p className="state-text">{notice}</p>
                  <div className="chips chips-center">
                    {suggestions?.map((s) => (
                      <Link key={s.topic} className="chip" href={feedHref(s.topic, s.lang)}>
                        <span aria-hidden>{getLanguage(s.lang).flag}</span> {s.topic}
                      </Link>
                    ))}
                  </div>
                </>
              ) : !loading && !hasMore ? (
                <>
                  <p className="state-emoji" aria-hidden>
                    🔍
                  </p>
                  <p className="state-title">Nothing good found</p>
                  <p className="state-text">
                    We skipped everything that wasn&apos;t clearly about &ldquo;{topic}&rdquo;. Try a different
                    wording or another language.
                  </p>
                  <Link className="btn btn-volt" href="/learn">
                    Change topic
                  </Link>
                </>
              ) : (
                <>
                  <div className="scan" aria-hidden>
                    <span />
                  </div>
                  <p className="state-title">Building your feed</p>
                  <p className="state-text">
                    Finding short videos about &ldquo;{topic}&rdquo; in {language.english} and skipping anything
                    off-topic.
                  </p>
                </>
              )}
            </div>
          </section>
        )}

        {slides.length > 0 && loading && items.length < goal && (
          <section className="slide">
            <div className="state-card">
              <div className="scan" aria-hidden>
                <span />
              </div>
              <p className="state-text">Loading more videos…</p>
            </div>
          </section>
        )}

        {slides.length > 0 && activeSlide?.kind === "video" && error && (
          <div className="inline-error">
            {error}{" "}
            <button type="button" onClick={() => load(cursor)}>
              Try again
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
    <div className={`video ${isActive ? "is-active" : ""}`}>
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
        <button type="button" className="rail-btn" onClick={onToggleMute} aria-label={muted ? "Turn sound on" : "Mute"}>
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
          <span>{muted ? "Sound" : "Mute"}</span>
        </button>
        <button type="button" className="rail-btn" onClick={onOffTopic} aria-label="Off-topic, remove it">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Off-topic</span>
        </button>
        <a
          className="rail-btn"
          href={`https://www.youtube.com/shorts/${video.id}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open on YouTube"
        >
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
            <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>YouTube</span>
        </a>
      </div>

      {isActive && muted && (
        <button type="button" className="unmute-pill" onClick={onToggleMute}>
          Tap for sound
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
        <svg viewBox="0 0 24 24" width="34" height="34">
          <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="state-title">{reason === "goal" ? "Session complete" : "That's everything, for now"}</p>
      <p className="state-text">
        {count} {count === 1 ? "video" : "videos"} on <strong>{topic}</strong> in about {minutes}{" "}
        {minutes === 1 ? "minute" : "minutes"}.
        {reason === "goal" ? " Stop here, or keep going?" : " Try a related topic to go deeper."}
      </p>
      <div className="end-actions">
        {reason === "goal" && (
          <button type="button" className="btn btn-volt" onClick={onContinue}>
            {SESSION_SIZE} more videos
          </button>
        )}
        <Link className={reason === "goal" ? "btn btn-ghost" : "btn btn-volt"} href="/learn">
          Change topic
        </Link>
      </div>
    </div>
  );
}
