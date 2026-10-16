"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getLanguage } from "@/lib/languages";
import { estimateMinutes } from "@/lib/paths";
import { XP } from "@/lib/xp";
import { deletePath, getPath, nextTodo, progress, savePath, type SavedPath } from "./paths";

export function PathOverview({ id }: { id: string }) {
  const router = useRouter();
  const [path, setPath] = useState<SavedPath | null | undefined>(undefined);

  useEffect(() => setPath(getPath(id)), [id]);

  if (path === undefined) return <main className="app-screen" />;
  if (path === null) return <MissingPath />;

  const p = progress(path);
  const language = getLanguage(path.lang);
  const minutes = Math.max(1, Math.round(estimateMinutes(path.steps.filter((s) => s.status !== "known"))));
  const started = path.position.video >= 0 || p.done > 0;
  const current = path.steps[path.position.step];
  const xpLeft = path.steps
    .filter((s) => s.status === "todo")
    .reduce((sum, s) => sum + XP.step + (s.videos?.length ?? 3) * XP.video, path.finished ? 0 : XP.path);

  function update(next: SavedPath) {
    setPath(savePath(next));
  }

  function toggleKnown(i: number) {
    if (!path) return;
    const steps = path.steps.map((s, k) =>
      k === i ? { ...s, status: s.status === "known" ? ("todo" as const) : ("known" as const) } : s,
    );
    let position = path.position;
    if (i === path.position.step && steps[i].status === "known") {
      const next = nextTodo({ ...path, steps }, i + 1);
      position = { step: next === -1 ? i : next, video: -1 };
    }
    update({ ...path, steps, position, finished: false });
  }

  function startAt(i: number) {
    if (!path) return;
    const steps = path.steps.map((s, k) => (k === i && s.status === "known" ? { ...s, status: "todo" as const } : s));
    savePath({ ...path, steps, position: { step: i, video: -1 }, finished: false });
    router.push(`/path/${path.id}/play`);
  }

  function restart() {
    if (!path) return;
    const steps = path.steps.map((s) => ({ ...s, status: s.status === "done" ? ("todo" as const) : s.status }));
    const first = nextTodo({ ...path, steps }, 0);
    savePath({ ...path, steps, position: { step: Math.max(0, first), video: -1 }, finished: false });
    router.push(`/path/${path.id}/play`);
  }

  function remove() {
    if (!path || !window.confirm(`Delete your “${path.title}” path? Your progress will be lost.`)) return;
    deletePath(path.id);
    router.replace("/library");
  }

  return (
    <main className="app-screen overview">
      <div className="aurora aurora-soft" aria-hidden>
        <span className="blob blob-volt" />
        <span className="blob blob-ultra" />
      </div>

      <header className="screen-top">
        <Link href="/library" className="icon-btn" aria-label="Library">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <span className="screen-kicker">Your path</span>
        <span className="saved-pill" title="Saved on this device">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Saved
        </span>
      </header>

      <section className="ov-hero enter enter-1">
        <div className="ov-emoji" aria-hidden>
          {path.emoji}
        </div>
        <div>
          <h1 className="ov-title">{path.title}</h1>
          <p className="ov-meta">
            {language.flag} {language.label} · {path.steps.length} steps · ~{minutes} min to go
          </p>
          {xpLeft > 0 && <p className="ov-xp">⚡ Up to +{xpLeft} XP to grab</p>}
        </div>
      </section>

      <div className="ov-progress enter enter-2" aria-label={`${Math.round(p.ratio * 100)}% done`}>
        <div className="ov-progress-bar" style={{ width: `${p.ratio * 100}%` }} />
      </div>

      {!started && path.startReason && (
        <p className="ov-reason enter enter-2">
          <span aria-hidden>✦</span> {path.startReason}
        </p>
      )}
      {path.notice && <p className="ov-notice enter enter-2">{path.notice}</p>}

      <ol className="timeline enter enter-3">
        {path.steps.map((s, i) => {
          const isCurrent = !path.finished && i === path.position.step;
          const state = isCurrent ? "current" : s.status;
          return (
            <li key={`${i}-${s.title}`} className={`tl-step tl-${state}`}>
              <button type="button" className="tl-main" onClick={() => startAt(i)}>
                <span className="tl-node" aria-hidden>
                  {s.status === "done" || s.status === "known" ? (
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="tl-text">
                  <span className="tl-title">{s.title}</span>
                  <span className="tl-summary">{s.summary}</span>
                  {s.status === "todo" && <span className="tl-xp">+{XP.step} XP</span>}
                  {isCurrent && (
                    <span className="tl-badge">{path.position.video >= 0 ? "You're here" : "Start here"}</span>
                  )}
                </span>
              </button>
              {s.status !== "done" && (
                <button
                  type="button"
                  className={`tl-toggle ${s.status === "known" ? "is-on" : ""}`}
                  onClick={() => toggleKnown(i)}
                  aria-pressed={s.status === "known"}
                  title={s.status === "known" ? "Mark as not known" : "I already know this"}
                >
                  {s.status === "known" ? "Known" : "I know this"}
                </button>
              )}
            </li>
          );
        })}
      </ol>

      <button type="button" className="ov-delete" onClick={remove}>
        Delete this path
      </button>

      <div className="sticky-cta">
        {path.finished ? (
          <button type="button" className="btn btn-volt btn-block" onClick={restart}>
            Path complete · Review from the start
          </button>
        ) : (
          <Link className="btn btn-volt btn-block" href={`/path/${path.id}/play`}>
            {started ? "Continue" : "Start"} · Step {path.position.step + 1}: {current?.title}
          </Link>
        )}
      </div>
    </main>
  );
}

export function MissingPath() {
  return (
    <main className="app-screen">
      <div className="state-card">
        <p className="state-emoji" aria-hidden>
          🗺️
        </p>
        <p className="state-title">This path isn&apos;t on this device</p>
        <p className="state-text">Paths are saved on the device where you made them. Start a new one here.</p>
        <Link className="btn btn-volt" href="/learn">
          Start a path
        </Link>
      </div>
    </main>
  );
}
