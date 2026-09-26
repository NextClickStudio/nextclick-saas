"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GarmentSVG } from "@/components/GarmentSVG";
import { Wordmark } from "@/components/Wordmark";
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

  const counts = RARITIES.map((r) => [r, garments.filter((g) => g.params.rarity === r).length] as const);

  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
      <header className="flex items-center justify-between pt-6">
        <Wordmark />
        <span className="eyebrow rounded-full bg-surface px-4 py-2.5">Lab</span>
      </header>

      <section className="mt-8">
        <p className="eyebrow">Atelier lab</p>
        <h1 className="headline mt-3 text-5xl sm:text-6xl">{view === "kept" ? "Your keeps" : "Fifty looks"}</h1>
        <p className="mt-3 max-w-lg text-lg leading-snug text-muted">
          Drawn from a seed, new on every regenerate. Keep the ones you&rsquo;d send down the runway.
        </p>
      </section>

      {/* Summary card */}
      <section className="mt-6 rounded-3xl bg-surface p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">This batch</p>
            <p className="headline mt-2 text-2xl">
              {garments.length} looks · {kept.length} kept
            </p>
          </div>
          <button
            onClick={() => setView((v) => (v === "kept" ? "grid" : "kept"))}
            className="shrink-0 rounded-full bg-bg px-4 py-2 text-sm font-bold"
          >
            {view === "kept" ? "All looks" : "Keeps"}
          </button>
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2">
          {counts.map(([r, n]) => (
            <div key={r}>
              <div className="h-1.5 rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${r === "legendary" ? "bg-gold" : r === "epic" ? "bg-accent" : "bg-ivory"}`}
                  style={{ width: `${garments.length ? Math.max(n ? 8 : 0, (n / garments.length) * 100) : 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted capitalize">
                {r} <span className="font-bold text-ivory">{n}</span>
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={regenerate} className="flex-1 rounded-2xl bg-ivory py-3.5 text-base font-bold text-bg transition-transform active:scale-[0.98]">
            Regenerate
          </button>
          {kept.length > 0 && (
            <button onClick={exportKept} className="rounded-2xl bg-surface-2 px-5 py-3.5 text-base font-bold transition-transform active:scale-[0.98]">
              Export
            </button>
          )}
        </div>
      </section>

      {/* Filters */}
      <section className="sticky top-0 z-20 -mx-5 mt-4 bg-bg/90 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <Chip active={rarity === "all"} onClick={() => setRarity("all")}>
            All
          </Chip>
          {RARITIES.map((r) => (
            <Chip key={r} active={rarity === r} onClick={() => setRarity(r)}>
              <span className="capitalize">{r}</span>
            </Chip>
          ))}
          <span className="mx-1 w-px shrink-0 bg-line" />
          <Chip active={figure} onClick={() => setFigure((v) => !v)}>
            Figure
          </Chip>
          <Chip active={handDrawn} onClick={() => setHandDrawn((v) => !v)}>
            Hand-drawn
          </Chip>
        </div>
        <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <Chip active={type === "all"} onClick={() => setType("all")}>
            All pieces
          </Chip>
          {GARMENT_TYPES.map((t) => (
            <Chip key={t} active={type === t} onClick={() => setType(t)}>
              {GARMENT_TYPE_LABELS[t]}
            </Chip>
          ))}
        </div>
      </section>

      {view === "kept" && kept.length === 0 && (
        <div className="mt-6 rounded-3xl bg-surface p-8 text-center text-muted">Nothing kept yet. Tap Keep under a look you love.</div>
      )}

      {/* Grid */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {garments.map(({ entry, params }, i) => {
          const isKept = keptKeys.has(keyOf(entry));
          return (
            <motion.article
              key={keyOf(entry) + figure + handDrawn}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: Math.min(i, 16) * 0.03, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col rounded-3xl bg-surface p-2.5"
            >
              <button
                onClick={() => setOpen(params)}
                className={`relative block aspect-[5/8] w-full overflow-hidden rounded-2xl bg-paper ring-${params.rarity}`}
                aria-label={`Open ${params.name}`}
              >
                <span className={`absolute bottom-2.5 left-2.5 z-10 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${RARITY_PILL[params.rarity]}`}>
                  {params.rarity}
                </span>
                <GarmentSVG params={params} figure={figure} handDrawn={handDrawn} background={false} className="h-full w-full" />
              </button>
              <div className="flex flex-1 flex-col px-1.5 pt-3 pb-1">
                <h2 className="text-[15px] leading-tight font-extrabold tracking-tight">{params.name}</h2>
                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  <span className="font-mono text-[11px] text-muted">{params.seed}</span>
                  <button
                    onClick={() => toggleKeep(entry)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${isKept ? "bg-ivory text-bg" : "bg-bg text-ivory"}`}
                  >
                    {isKept ? "Kept" : "Keep"}
                  </button>
                </div>
              </div>
            </motion.article>
          );
        })}
      </section>

      {/* Detail */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 overflow-y-auto bg-bg"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mx-auto max-w-5xl px-5 pt-6 pb-12 sm:px-8">
              <button onClick={() => setOpen(null)} className="flex items-center gap-2 text-lg font-bold text-muted hover:text-ivory">
                <span aria-hidden>&lsaquo;</span> Back
              </button>
              <div className="mt-6 flex flex-col gap-6 md:flex-row">
                <div className="rounded-3xl bg-surface p-3 md:w-[420px]">
                  <div className={`aspect-[5/8] w-full overflow-hidden rounded-2xl bg-paper ring-${open.rarity}`}>
                    <GarmentSVG params={open} figure={figure} handDrawn={handDrawn} background={false} className="h-full w-full" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="eyebrow">
                    {open.rarity} · {GARMENT_TYPE_LABELS[open.type]}
                  </p>
                  <h2 className="headline mt-3 text-4xl sm:text-5xl">{open.name}</h2>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <Stat label="Intensity" value={`${Math.round(open.intensity * 100)}`} bar={open.intensity} />
                    <Stat label="Seed" value={open.seed} mono />
                    <Stat label="Material" value={open.material.id} />
                    <Stat label="Finish" value={open.finish} />
                  </div>
                  {openEntry && (
                    <button
                      onClick={() => toggleKeep(openEntry)}
                      className="mt-6 w-full rounded-2xl bg-ivory py-4 text-lg font-bold text-bg transition-transform active:scale-[0.98]"
                    >
                      {keptKeys.has(keyOf(openEntry)) ? "Kept" : "Keep this look"}
                    </button>
                  )}
                  <details className="mt-6 rounded-3xl bg-surface p-5">
                    <summary className="eyebrow cursor-pointer">Parameters</summary>
                    <pre className="mt-4 overflow-x-auto font-mono text-[11px] leading-relaxed text-muted">{JSON.stringify(open, null, 2)}</pre>
                  </details>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

const RARITY_PILL: Record<Rarity, string> = {
  common: "bg-bg/80 text-ivory",
  rare: "bg-bg text-ivory",
  epic: "bg-accent text-ivory",
  legendary: "bg-gold text-bg",
};

function Stat({ label, value, bar, mono }: { label: string; value: string; bar?: number; mono?: boolean }) {
  return (
    <div className="rounded-3xl bg-surface p-5">
      <p className={`text-2xl font-extrabold tracking-tight capitalize ${mono ? "font-mono text-lg normal-case" : ""}`}>{value}</p>
      {bar !== undefined && (
        <div className="mt-3 h-1.5 rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(4, bar * 100)}%` }} />
        </div>
      )}
      <p className="mt-2 text-sm text-muted">{label}</p>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors ${active ? "bg-ivory text-bg" : "bg-surface text-muted hover:text-ivory"}`}
    >
      {children}
    </button>
  );
}
