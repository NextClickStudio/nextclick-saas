"use client";

import { useEffect, useState } from "react";
import { award, dayKey, EMPTY_STATS, levelFor, type Stats, type XpKind } from "@/lib/xp";

/** XP, livello e serie vivono solo su questo dispositivo (localStorage). */
const KEY = "scopo:stats";
const EVENT = "scopo:stats";

export type Gain = { kind: XpKind; amount: number; stats: Stats; levelUp: boolean };

export function readStats(): Stats {
  try {
    const raw = window.localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<Stats>) : {};
    return {
      ...EMPTY_STATS,
      ...Object.fromEntries(Object.entries(saved).filter(([, v]) => typeof v === "number" || typeof v === "string")),
    };
  } catch {
    return EMPTY_STATS;
  }
}

/** Assegna i punti, li salva e avvisa chi li mostra (barra in alto, statistiche). */
export function earn(kind: XpKind): Gain {
  const before = readStats();
  const after = award(before, kind, dayKey(new Date()));
  try {
    window.localStorage.setItem(KEY, JSON.stringify(after));
  } catch {
    // storage non disponibile: i punti valgono solo per questa visita
  }
  const gain: Gain = {
    kind,
    amount: after.xp - before.xp,
    stats: after,
    levelUp: levelFor(after.xp).level > levelFor(before.xp).level,
  };
  window.dispatchEvent(new CustomEvent<Gain>(EVENT, { detail: gain }));
  return gain;
}

export function useStats(): Stats | null {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    setStats(readStats());
    const onGain = (e: Event) => setStats((e as CustomEvent<Gain>).detail.stats);
    window.addEventListener(EVENT, onGain);
    return () => window.removeEventListener(EVENT, onGain);
  }, []);
  return stats;
}

/** Vibrazione breve dove il telefono la supporta (Android); su iPhone non fa nulla. */
export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // ignorata
  }
}
