"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLanguage, scanHref, type LangCode } from "@/lib/languages";
import { InstallHint } from "./InstallHint";
import { Logo } from "./Logo";
import { PathCard } from "./PathCard";
import { listPaths, type SavedPath } from "./paths";
import { readLang } from "./prefs";
import { SearchBox } from "./SearchBox";
import { TabBar } from "./TabBar";

type Tile = { topic: string; emoji: string; lang?: LangCode };

const IDEAS: Tile[] = [
  { topic: "Guitar", emoji: "🎸" },
  { topic: "Snowboarding", emoji: "🏂" },
  { topic: "Chess", emoji: "♟️" },
  { topic: "Knife skills", emoji: "🔪" },
  { topic: "Photography", emoji: "📷" },
  { topic: "Piano", emoji: "🎹" },
  { topic: "Skiing", emoji: "⛷️" },
  { topic: "Psychology", emoji: "🧠" },
];

type Props = {
  liveSearch: boolean;
  demoTiles: Tile[];
};

export function LearnHome({ liveSearch, demoTiles }: Props) {
  const [resume, setResume] = useState<SavedPath | null>(null);
  const [lang, setLang] = useState<LangCode>("en");

  useEffect(() => {
    setResume(listPaths().find((p) => !p.finished) ?? null);
    setLang(readLang());
  }, []);

  const tiles = liveSearch ? IDEAS : demoTiles;

  return (
    <main className="learn with-tabs">
      <div className="aurora aurora-soft" aria-hidden>
        <span className="blob blob-volt" />
        <span className="blob blob-ultra" />
      </div>

      <header className="learn-top">
        <Link href="/" aria-label="About Scopo">
          <Logo size={28} />
        </Link>
        <span className="pill pill-beta">beta</span>
      </header>

      {resume && (
        <section className="learn-block resume enter enter-1">
          <h2 className="learn-label">Pick up where you left off</h2>
          <PathCard path={resume} big />
        </section>
      )}

      <h1 className="learn-title enter enter-1">
        What do you want
        <br />
        to <span className="grad-text">learn</span> next?
      </h1>

      <div className="enter enter-2">
        <SearchBox variant="app" />
      </div>
      <p className="learn-note enter enter-2">
        Next you&apos;ll tell us what you already know. We build an ordered path that starts right there.
      </p>

      <section className="learn-block enter enter-4">
        <h2 className="learn-label">{liveSearch ? "Popular paths" : "Ready in the demo"}</h2>
        <div className="tiles">
          {tiles.map((t, i) => {
            const tileLang = t.lang ?? lang;
            return (
              <Link
                key={t.topic}
                className={`topic-tile tone-${i % 6}`}
                href={scanHref(t.topic, tileLang)}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className="topic-emoji" aria-hidden>
                  {t.emoji}
                </span>
                <span className="topic-name">{t.topic}</span>
                <span className="topic-lang">{getLanguage(tileLang).flag}</span>
              </Link>
            );
          })}
        </div>
        {!liveSearch && (
          <p className="learn-note">
            The demo has hand-picked paths. Paths for any topic are switching on very soon.
          </p>
        )}
      </section>

      <InstallHint />

      <footer className="learn-footer">
        <Link href="/privacy">Privacy</Link>
        <Link href="/cookies">Cookies</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/">About</Link>
      </footer>

      <TabBar />
    </main>
  );
}
