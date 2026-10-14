"use client";

import { DEFAULT_LANG, isLangCode, langFromLocale, type LangCode } from "@/lib/languages";

/**
 * Preferenze salvate solo sul dispositivo (localStorage). Nessun cookie.
 * Tutte le letture/scritture sono protette: in navigazione privata possono fallire.
 */
const LANG_KEY = "scopo:lang";
const RECENT_KEY = "scopo:recent";
const MAX_RECENT = 6;

export type RecentTopic = { topic: string; lang: LangCode };

export function readLang(): LangCode {
  try {
    const saved = window.localStorage.getItem(LANG_KEY);
    if (isLangCode(saved)) return saved;
  } catch {
    // storage non disponibile
  }
  return typeof navigator !== "undefined" ? langFromLocale(navigator.language) : DEFAULT_LANG;
}

export function saveLang(lang: LangCode) {
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    // pazienza
  }
}

export function readRecent(): RecentTopic[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter(
        (x): x is RecentTopic =>
          typeof x === "object" && x !== null && typeof x.topic === "string" && isLangCode(x.lang),
      )
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function rememberTopic(topic: string, lang: LangCode) {
  try {
    const t = topic.trim();
    if (!t) return;
    const next = [
      { topic: t, lang },
      ...readRecent().filter((x) => !(x.topic.toLowerCase() === t.toLowerCase() && x.lang === lang)),
    ].slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // pazienza
  }
}

export function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function setFlag(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // pazienza
  }
}
