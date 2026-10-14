"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { feedHref, getLanguage, type LangCode } from "@/lib/languages";
import { InstallHint } from "./InstallHint";
import { Logo } from "./Logo";
import { readLang, readRecent, type RecentTopic } from "./prefs";
import { SearchBox } from "./SearchBox";

type Tile = { topic: string; emoji: string; lang?: LangCode };

const IDEAS: Tile[] = [
  { topic: "Guitar", emoji: "🎸" },
  { topic: "Snowboard tricks", emoji: "🏂" },
  { topic: "Chess openings", emoji: "♟️" },
  { topic: "Knife skills", emoji: "🔪" },
  { topic: "Photography", emoji: "📷" },
  { topic: "Piano", emoji: "🎹" },
  { topic: "Skiing technique", emoji: "⛷️" },
  { topic: "Psychology", emoji: "🧠" },
];

type Props = {
  liveSearch: boolean;
  demoTiles: Tile[];
};

export function LearnHome({ liveSearch, demoTiles }: Props) {
  const [recent, setRecent] = useState<RecentTopic[]>([]);
  const [lang, setLang] = useState<LangCode>("en");

  useEffect(() => {
    setRecent(readRecent());
    setLang(readLang());
  }, []);

  const tiles = liveSearch ? IDEAS : demoTiles;

  return (
    <main className="learn">
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

      <h1 className="learn-title enter enter-1">
        What do you want
        <br />
        to <span className="grad-text">learn</span> today?
      </h1>

      <div className="enter enter-2">
        <SearchBox variant="app" />
      </div>

      {recent.length > 0 && (
        <section className="learn-block enter enter-3">
          <h2 className="learn-label">Jump back in</h2>
          <div className="chips">
            {recent.map((r) => (
              <Link key={`${r.topic}-${r.lang}`} className="chip" href={feedHref(r.topic, r.lang)}>
                <span aria-hidden>{getLanguage(r.lang).flag}</span> {r.topic}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="learn-block enter enter-4">
        <h2 className="learn-label">{liveSearch ? "Popular right now" : "Ready in the demo"}</h2>
        <div className="tiles">
          {tiles.map((t, i) => {
            const tileLang = t.lang ?? lang;
            return (
              <Link
                key={t.topic}
                className={`topic-tile tone-${i % 6}`}
                href={feedHref(t.topic, tileLang)}
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
            This demo has a hand-picked set of topics. Search for anything is switching on very soon.
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
    </main>
  );
}
