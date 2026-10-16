"use client";

import { DEFAULT_LANG, isLangCode, langFromLocale, type LangCode } from "@/lib/languages";

/**
 * Preferenze salvate solo sul dispositivo (localStorage). Nessun cookie.
 * Tutte le letture/scritture sono protette: in navigazione privata possono fallire.
 */
const LANG_KEY = "scopo:lang";

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
