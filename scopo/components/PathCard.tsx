"use client";

import Link from "next/link";
import { getLanguage } from "@/lib/languages";
import { progress, type SavedPath } from "./paths";

/** Scheda di un percorso salvato: dove sei arrivato e il pulsante per continuare. */
export function PathCard({ path, big = false }: { path: SavedPath; big?: boolean }) {
  const p = progress(path);
  const pct = Math.round(p.ratio * 100);
  const status = path.finished
    ? "Completed"
    : `Step ${path.position.step + 1} of ${p.total} · ${p.current?.title ?? ""}`;
  return (
    <article className={`path-card ${big ? "path-card-big" : ""}`}>
      <Link href={`/path/${path.id}`} className="path-card-main">
        <span className="path-card-emoji" aria-hidden>
          {path.emoji}
        </span>
        <span className="path-card-text">
          <span className="path-card-title">
            {path.title} <span aria-hidden>{getLanguage(path.lang).flag}</span>
          </span>
          <span className="path-card-status">{status}</span>
        </span>
        <span className="path-card-ring" aria-label={`${pct}% done`}>
          <svg viewBox="0 0 36 36" width="40" height="40" aria-hidden>
            <circle cx="18" cy="18" r="15" className="ring-bg" />
            <circle cx="18" cy="18" r="15" className="ring-fg-small" style={{ strokeDashoffset: 94.25 * (1 - p.ratio) }} />
          </svg>
          <span>{pct}%</span>
        </span>
      </Link>
      {!path.finished && (
        <Link href={`/path/${path.id}/play`} className="btn btn-volt btn-sm path-card-go">
          {path.position.video >= 0 || p.done > 0 ? "Continue" : "Start"}
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
        </Link>
      )}
    </article>
  );
}
