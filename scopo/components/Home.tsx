"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readRecentTopics } from "./recentTopics";

type Props = {
  liveSearch: boolean;
  aiCuration: boolean;
  demoTopics: Array<{ label: string; emoji: string }>;
};

const IDEAS = [
  { label: "Politica italiana", emoji: "🏛️" },
  { label: "Storia", emoji: "📜" },
  { label: "Finanza personale", emoji: "💶" },
  { label: "Scienza", emoji: "🔭" },
  { label: "Inglese", emoji: "🇬🇧" },
  { label: "Psicologia", emoji: "🧠" },
  { label: "Programmazione", emoji: "💻" },
  { label: "Filosofia", emoji: "🤔" },
];

export function Home({ liveSearch, aiCuration, demoTopics }: Props) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => setRecent(readRecentTopics()), []);

  const chips = liveSearch ? IDEAS : demoTopics;

  function go(t: string) {
    const clean = t.trim();
    if (!clean) return;
    router.push(`/feed?t=${encodeURIComponent(clean)}`);
  }

  return (
    <main className="home">
      <div className="home-inner">
        <p className="brand">
          <span className="brand-dot" aria-hidden />
          Scopo
        </p>

        <h1 className="home-title">
          Scrolla con
          <br />
          uno scopo.
        </h1>
        <p className="home-sub">
          Scrivi cosa vuoi imparare. Il tuo feed di video brevi parlerà solo di quello.
        </p>

        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            go(topic);
          }}
        >
          <input
            className="search-input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="es. politica italiana"
            aria-label="Cosa vuoi imparare?"
            maxLength={80}
            autoComplete="off"
            enterKeyHint="go"
          />
          <button className="search-btn" type="submit" disabled={!topic.trim()}>
            Crea il feed
          </button>
        </form>

        <div className="chips" aria-label="Idee">
          {chips.map((c) => (
            <button key={c.label} type="button" className="chip" onClick={() => go(c.label)}>
              <span aria-hidden>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>

        {recent.length > 0 && (
          <div className="recent">
            <p className="recent-label">Cercati di recente</p>
            <div className="chips">
              {recent.map((t) => (
                <button key={t} type="button" className="chip chip-quiet" onClick={() => go(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        <ul className="promises">
          <li>
            <strong>Solo il tuo argomento.</strong> Niente video a caso che ti portano altrove.
          </li>
          <li>
            <strong>Niente risse né clickbait.</strong>{" "}
            {aiCuration
              ? "Ogni video è controllato dall'AI e ti dice cosa impari."
              : "Scartiamo i titoli fatti solo per farti arrabbiare."}
          </li>
          <li>
            <strong>Sessioni con una fine.</strong> Dopo 12 video ti fermi e decidi tu se continuare.
          </li>
        </ul>

        {!liveSearch && (
          <p className="demo-note">
            Versione demo: argomenti pronti con video selezionati a mano. Con la chiave YouTube
            l'app cerca qualsiasi argomento.
          </p>
        )}
      </div>
    </main>
  );
}
