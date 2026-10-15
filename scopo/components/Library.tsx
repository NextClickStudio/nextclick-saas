"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PathCard } from "./PathCard";
import { listPaths, type SavedPath } from "./paths";
import { TabBar } from "./TabBar";

export function Library() {
  const [paths, setPaths] = useState<SavedPath[] | null>(null);
  useEffect(() => setPaths(listPaths()), []);

  const inProgress = paths?.filter((p) => !p.finished) ?? [];
  const finished = paths?.filter((p) => p.finished) ?? [];

  return (
    <main className="app-screen with-tabs">
      <div className="aurora aurora-soft" aria-hidden>
        <span className="blob blob-volt" />
        <span className="blob blob-ultra" />
      </div>
      <h1 className="learn-title enter enter-1">Your library</h1>
      <p className="screen-sub enter enter-1">Every path is saved on this device. Pick up exactly where you stopped.</p>

      {paths !== null && paths.length === 0 && (
        <section className="empty enter enter-2">
          <p className="state-emoji" aria-hidden>
            🗺️
          </p>
          <p className="state-title">No paths yet</p>
          <p className="state-text">Tell Scopo what you want to learn and what you already know. Your path will appear here.</p>
          <Link href="/learn" className="btn btn-volt">
            Build my first path
          </Link>
        </section>
      )}

      {inProgress.length > 0 && (
        <section className="learn-block enter enter-2">
          <h2 className="learn-label">In progress</h2>
          <div className="path-list">
            {inProgress.map((p) => (
              <PathCard key={p.id} path={p} />
            ))}
          </div>
        </section>
      )}

      {finished.length > 0 && (
        <section className="learn-block enter enter-3">
          <h2 className="learn-label">Completed</h2>
          <div className="path-list">
            {finished.map((p) => (
              <PathCard key={p.id} path={p} />
            ))}
          </div>
        </section>
      )}

      <TabBar />
    </main>
  );
}
