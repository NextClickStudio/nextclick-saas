"use client";

import type { LangCode } from "@/lib/languages";
import type { Level, PathPlan, PlanStep } from "@/lib/paths";
import type { Video } from "@/lib/types";

/**
 * I percorsi salvati vivono solo su questo dispositivo (localStorage):
 * niente account, niente server. Ogni lettura/scrittura è protetta.
 */
const KEY = "scopo:paths";
const MAX_PATHS = 30;

export type StepStatus = "known" | "todo" | "done";

export type SavedStep = Omit<PlanStep, "videos"> & {
  status: StepStatus;
  /** undefined = non ancora caricati; [] = nessun video buono trovato. */
  videos?: Video[];
  cursor?: string | null;
  /** Indice dell'ultimo video raggiunto: i punti di un video si prendono una volta sola. */
  seen?: number;
};

export type SavedPath = {
  id: string;
  topic: string;
  title: string;
  emoji: string;
  lang: LangCode;
  mode: PathPlan["mode"];
  level: Level;
  known: string;
  startReason: string;
  notice?: string;
  steps: SavedStep[];
  /** Dove sei arrivato: passo e video (-1 = la scheda introduttiva del passo). */
  position: { step: number; video: number };
  finished: boolean;
  createdAt: number;
  updatedAt: number;
};

function readAll(): SavedPath[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    return list.filter(
      (p): p is SavedPath =>
        typeof p === "object" &&
        p !== null &&
        typeof p.id === "string" &&
        Array.isArray(p.steps) &&
        typeof p.position === "object",
    );
  } catch {
    return [];
  }
}

function writeAll(list: SavedPath[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_PATHS)));
  } catch {
    // storage pieno o non disponibile: il percorso resta solo in memoria
  }
}

export function listPaths(): SavedPath[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getPath(id: string): SavedPath | null {
  return readAll().find((p) => p.id === id) ?? null;
}

export function savePath(path: SavedPath): SavedPath {
  const next = { ...path, updatedAt: Date.now() };
  writeAll([next, ...readAll().filter((p) => p.id !== path.id)]);
  return next;
}

export function deletePath(id: string) {
  writeAll(readAll().filter((p) => p.id !== id));
}

export function pathFromPlan(plan: PathPlan, level: Level, known: string): SavedPath {
  const now = Date.now();
  const id = `${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    topic: plan.topic,
    title: plan.title,
    emoji: plan.emoji,
    lang: plan.lang,
    mode: plan.mode,
    level,
    known,
    startReason: plan.startReason,
    notice: plan.notice,
    steps: plan.steps.map((s, i) => ({
      ...s,
      status: i < plan.startIndex ? "known" : "todo",
    })),
    position: { step: plan.startIndex, video: -1 },
    finished: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** Prossimo passo da fare a partire da `from` (incluso), saltando quelli che conosci. */
export function nextTodo(path: SavedPath, from: number): number {
  for (let i = Math.max(0, from); i < path.steps.length; i++) {
    if (path.steps[i].status !== "known") return i;
  }
  return -1;
}

export function progress(path: SavedPath) {
  const total = path.steps.length;
  const done = path.steps.filter((s) => s.status === "done").length;
  const known = path.steps.filter((s) => s.status === "known").length;
  const ratio = total === 0 ? 0 : (done + known) / total;
  return { total, done, known, ratio, current: path.steps[path.position.step] };
}
