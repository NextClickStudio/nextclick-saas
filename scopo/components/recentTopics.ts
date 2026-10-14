"use client";

const KEY = "scopo:recent-topics";
const MAX = 6;

export function readRecentTopics(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((t): t is string => typeof t === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function rememberTopic(topic: string) {
  try {
    const t = topic.trim();
    if (!t) return;
    const next = [t, ...readRecentTopics().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage non disponibile (es. navigazione privata): pazienza
  }
}
