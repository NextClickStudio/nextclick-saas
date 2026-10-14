"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEFAULT_LANG, feedHref, getLanguage, LANGUAGES, type LangCode } from "@/lib/languages";
import { readLang, saveLang } from "./prefs";

type Props = {
  variant?: "hero" | "app";
  placeholder?: string;
};

export function SearchBox({ variant = "hero", placeholder = "guitar, snowboard tricks, chess…" }: Props) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [lang, setLang] = useState<LangCode>(DEFAULT_LANG);

  useEffect(() => setLang(readLang()), []);

  const language = getLanguage(lang);

  function pickLang(next: LangCode) {
    setLang(next);
    saveLang(next);
  }

  return (
    <form
      className={`search search--${variant}`}
      onSubmit={(e) => {
        e.preventDefault();
        const t = topic.trim();
        if (!t) return;
        saveLang(lang);
        router.push(feedHref(t, lang));
      }}
    >
      <div className="search-field">
        <svg className="search-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          className="search-input"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={placeholder}
          aria-label="What do you want to learn?"
          maxLength={80}
          autoComplete="off"
          autoCapitalize="off"
          enterKeyHint="go"
        />
      </div>

      <div className="search-actions">
        <label className="lang-pill" title="Language of the videos">
          <span className="lang-flag" aria-hidden>
            {language.flag}
          </span>
          <span className="lang-name">{language.label}</span>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <select
            value={lang}
            onChange={(e) => pickLang(e.target.value as LangCode)}
            aria-label="Language of the videos"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.label}
              </option>
            ))}
          </select>
        </label>

        <button className="btn btn-volt search-go" type="submit" disabled={!topic.trim()}>
          <span>Start scrolling</span>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </form>
  );
}
