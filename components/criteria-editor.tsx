"use client";

// Lista modificabile di criteri: nome, descrizione, come verificarlo, peso 1-5.
import type { CriterionDraft } from "@/lib/types";
import { btn, input } from "@/components/ui";

export default function CriteriaEditor({
  criteria,
  onChange,
}: {
  criteria: CriterionDraft[];
  onChange: (next: CriterionDraft[]) => void;
}) {
  const update = (i: number, patch: Partial<CriterionDraft>) =>
    onChange(criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => onChange(criteria.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= criteria.length) return;
    const next = [...criteria];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...criteria, { name: "", description: "", how_to_check: "", weight: 3 }]);

  return (
    <div className="space-y-3">
      {criteria.map((c, i) => (
        <div key={c.id ?? `new-${i}`} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">#{i + 1}</span>
            <input
              className={`${input} flex-1 font-medium`}
              placeholder="Nome del criterio (es. Guida alla scelta del prodotto)"
              value={c.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              Peso
              <select
                className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
                value={c.weight}
                onChange={(e) => update(i, { weight: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5].map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex">
              <button type="button" className={btn.ghost} onClick={() => move(i, -1)} aria-label="Sposta su">
                ↑
              </button>
              <button type="button" className={btn.ghost} onClick={() => move(i, 1)} aria-label="Sposta giù">
                ↓
              </button>
              <button type="button" className={`${btn.ghost} text-red-600`} onClick={() => remove(i)}>
                Rimuovi
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <textarea
              className={input}
              rows={3}
              placeholder="Cosa misura"
              value={c.description}
              onChange={(e) => update(i, { description: e.target.value })}
            />
            <textarea
              className={input}
              rows={3}
              placeholder="Come verificarlo leggendo il sito"
              value={c.how_to_check}
              onChange={(e) => update(i, { how_to_check: e.target.value })}
            />
          </div>
        </div>
      ))}
      <button type="button" className={btn.secondary} onClick={add}>
        + Aggiungi criterio
      </button>
    </div>
  );
}
