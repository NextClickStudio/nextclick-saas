"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GarmentSVG } from "@/components/GarmentSVG";
import { GAME_CONFIG, RARITIES, Rarity } from "@/config/game";
import { generateGarment } from "@/lib/garment/generate";
import { randomSeed } from "@/lib/garment/rng";
import { GARMENT_TYPES, GARMENT_TYPE_LABELS, GarmentParams, GarmentType } from "@/lib/garment/types";

interface Entry {
  seed: string;
  type?: GarmentType;
  rarity?: Rarity;
}

const KEPT_KEY = "maison.lab.kept";

function loadKept(): Entry[] {
  try {
    return JSON.parse(localStorage.getItem(KEPT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveKept(entries: Entry[]) {
  try {
    localStorage.setItem(KEPT_KEY, JSON.stringify(entries));
  } catch {
    /* private mode: keeping works for this visit only */
  }
}

const keyOf = (e: Entry) => `${e.seed}|${e.type ?? "*"}|${e.rarity ?? "*"}`;

export function LabClient() {
  const [batch, setBatch] = useState("maison");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [type, setType] = useState<GarmentType | "all">("all");
  const [figure, setFigure] = useState(true);
  const [handDrawn, setHandDrawn] = useState(true);
  const [view, setView] = useState<"grid" | "kept">("grid");
  const [kept, setKept] = useState<Entry[]>([]);
  const [open, setOpen] = useState<GarmentParams | null>(null);

  useEffect(() => {
    // Read favourites after mount (localStorage only exists in the browser).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKept(loadKept());
  }, []);

  const entries: Entry[] = useMemo(() => {
    if (view === "kept") return kept;
    return Array.from({ length: GAME_CONFIG.lab.gridSize }, (_, i) => ({
      seed: `${batch}-${i}`,
      type: type === "all" ? undefined : type,
      rarity: rarity === "all" ? undefined : rarity,
    }));
  }, [batch, rarity, type, view, kept]);

  const garments = useMemo(() => entries.map((e) => ({ entry: e, params: generateGarment(e.seed, { type: e.type, rarity: e.rarity }) })), [entries]);

  const keptKeys = useMemo(() => new Set(kept.map(keyOf)), [kept]);

  const toggleKeep = useCallback((e: Entry) => {
    setKept((prev) => {
      const k = keyOf(e);
      const next = prev.some((p) => keyOf(p) === k) ? prev.filter((p) => keyOf(p) !== k) : [...prev, e];
      saveKept(next);
      return next;
    });
  }, []);

  const exportKept = () => {
    const data = kept.map((e) => ({ ...e, params: generateGarment(e.seed, { type: e.type, rarity: e.rarity }) }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "maison-kept-garments.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const regenerate = () => {
    setView("grid");
    setBatch(randomSeed());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openEntry = open ? entries.find((e) => e.seed === open.seed) : undefined;

  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 sm:px-8">
      <header className="flex flex-col items-center pt-12 pb-8 text-center">
        <p className="label text-warm">Atelier Lab</p>
        <h1 className="font-display mt-4 text-4xl tracking-[0.18em] uppercase sm:text-6xl">Maison</h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-warm">
          Fifty garments, drawn from a seed. Keep the ones you would put on the runway.
        </p>
      </header>

      {/* Controls */}
      <section className="z-20 -mx-4 border-y lg:sticky lg:top-0 border-line bg-ivory/95 px-4 py-4 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-4 flex gap-x-1 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
            <Chip active={rarity === "all"} onClick={() => setRarity("all")}>
              All rarities
            </Chip>
            {RARITIES.map((r) => (
              <Chip key={r} active={rarity === r} onClick={() => setRarity(r)}>
                {r}
              </Chip>
            ))}
          </div>
          <div className="-mx-4 flex gap-x-1 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
            <Chip active={type === "all"} onClick={() => setType("all")}>
              All pieces
            </Chip>
            {GARMENT_TYPES.map((t) => (
              <Chip key={t} active={type === t} onClick={() => setType(t)}>
                {GARMENT_TYPE_LABELS[t]}
              </Chip>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          <button onClick={regenerate} className="label shrink-0 bg-ink px-5 py-2.5 text-ivory transition-opacity hover:opacity-80">
            Regenerate
          </button>
          <Chip active={figure} onClick={() => setFigure((v) => !v)}>
            Figure
          </Chip>
          <Chip active={handDrawn} onClick={() => setHandDrawn((v) => !v)}>
            Hand-drawn
          </Chip>
          <span className="mx-1 hidden h-4 w-px bg-line sm:block" />
          <Chip active={view === "kept"} onClick={() => setView((v) => (v === "kept" ? "grid" : "kept"))}>
            Kept · {kept.length}
          </Chip>
          {kept.length > 0 && (
            <button onClick={exportKept} className="label px-2 py-2 text-warm underline-offset-4 hover:underline">
              Export
            </button>
          )}
        </div>
      </section>

      {view === "kept" && kept.length === 0 && (
        <p className="py-24 text-center text-sm text-warm">Nothing kept yet. Tap “Keep” under a garment you love.</p>
      )}

      {/* Grid */}
      <section className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-5">
        {garments.map(({ entry, params }, i) => (
          <motion.article
            key={keyOf(entry) + figure + handDrawn}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: Math.min(i, 20) * 0.025, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col"
          >
            <button onClick={() => setOpen(params)} className={`relative block aspect-[5/8] w-full bg-ivory p-2 frame-${params.rarity}`} aria-label={`Open ${params.name}`}>
              <GarmentSVG params={params} figure={figure} handDrawn={handDrawn} background={false} className="h-full w-full" />
            </button>
            <div className="mt-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`label ${params.rarity === "legendary" ? "text-gold" : "text-warm"}`}>{params.rarity}</p>
                <h2 className="font-display mt-1 text-[0.95rem] leading-snug">{params.name}</h2>
              </div>
              <button
                onClick={() => toggleKeep(entry)}
                className={`label shrink-0 border px-2 py-1 transition-colors ${keptKeys.has(keyOf(entry)) ? "border-ink bg-ink text-ivory" : "border-line text-warm hover:border-ink hover:text-ink"}`}
              >
                {keptKeys.has(keyOf(entry)) ? "Kept" : "Keep"}
              </button>
            </div>
          </motion.article>
        ))}
      </section>

      {/* Detail */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 overflow-y-auto bg-ivory"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="sticky top-0 z-10 flex justify-end bg-ivory/95 px-4 py-3 backdrop-blur sm:px-8">
              <button onClick={() => setOpen(null)} className="label px-2 py-2 text-warm hover:text-ink">
                Close
              </button>
            </div>
            <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 pb-12 sm:px-8 md:flex-row">
              <div className={`mx-auto aspect-[5/8] w-full max-w-md bg-ivory p-3 frame-${open.rarity}`}>
                <GarmentSVG params={open} figure={figure} handDrawn={handDrawn} background={false} className="h-full w-full" />
              </div>
              <div className="flex-1">
                <p className={`label ${open.rarity === "legendary" ? "text-gold" : "text-warm"}`}>
                  {open.rarity} · {GARMENT_TYPE_LABELS[open.type]}
                </p>
                <h2 className="font-display mt-3 text-3xl leading-tight">{open.name}</h2>
                <dl className="mt-8 grid grid-cols-2 gap-y-3 border-t border-line pt-6 text-sm">
                  <dt className="label text-warm">Seed</dt>
                  <dd className="font-mono">{open.seed}</dd>
                  <dt className="label text-warm">Intensity</dt>
                  <dd>{Math.round(open.intensity * 100)} / 100</dd>
                  <dt className="label text-warm">Material</dt>
                  <dd className="capitalize">{open.material.id}</dd>
                  <dt className="label text-warm">Finish</dt>
                  <dd className="capitalize">{open.finish}</dd>
                </dl>
                {openEntry && (
                  <button
                    onClick={() => toggleKeep(openEntry)}
                    className="label mt-8 border border-ink px-6 py-3 transition-colors hover:bg-ink hover:text-ivory"
                  >
                    {keptKeys.has(keyOf(openEntry)) ? "Kept" : "Keep this piece"}
                  </button>
                )}
                <details className="mt-8 border-t border-line pt-4">
                  <summary className="label cursor-pointer text-warm">Parameters</summary>
                  <pre className="mt-4 overflow-x-auto bg-paper p-4 text-[11px] leading-relaxed">{JSON.stringify(open, null, 2)}</pre>
                </details>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`label shrink-0 whitespace-nowrap border px-3 py-2 transition-colors ${active ? "border-ink text-ink" : "border-transparent text-warm hover:text-ink"}`}
    >
      {children}
    </button>
  );
}
