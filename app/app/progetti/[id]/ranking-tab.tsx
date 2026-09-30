"use client";

import Link from "next/link";
import { useState } from "react";
import { CopyButton, StatusSelect } from "@/components/company-controls";
import { EmptyState, ScoreBar, btn } from "@/components/ui";
import type { TabProps } from "./tabs";

export default function RankingTab({ project, criteria, rows, siteUrl }: TabProps) {
  const [view, setView] = useState<"classifica" | "priorita">("classifica");
  const analyzed = rows.filter((r) => r.analysis);

  // Classifica: punteggio alto in cima. Priorità: punteggio basso (sintomo forte) in cima.
  const sorted = [...analyzed].sort((a, b) =>
    view === "classifica" ? (a.position ?? 0) - (b.position ?? 0) : (b.position ?? 0) - (a.position ?? 0),
  );

  if (analyzed.length === 0) {
    return <EmptyState>La classifica apparirà dopo la prima analisi completata (tab Analisi).</EmptyState>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5">
          {(["classifica", "priorita"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === v ? "bg-accent text-white" : "text-gray-700 hover:bg-gray-50"}`}
            >
              {v === "classifica" ? "Classifica" : "Priorità prospect"}
            </button>
          ))}
        </div>
        <a href={`/api/admin/export?projectId=${project.id}`} className={btn.secondary}>
          Esporta CSV
        </a>
      </div>
      <p className="text-sm text-gray-600">
        {view === "classifica"
          ? "Dal sito più bravo al meno bravo. È l'ordine della classifica pubblica."
          : "Dal sintomo più forte al più debole: in cima i prospect più interessanti da contattare."}
      </p>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">{view === "classifica" ? "Pos." : "Priorità"}</th>
              <th className="px-3 py-2">Azienda</th>
              <th className="px-3 py-2">Punteggio</th>
              <th className="px-3 py-2">Criteri</th>
              <th className="px-3 py-2">Stato</th>
              <th className="px-3 py-2">Visite</th>
              <th className="px-3 py-2">Report</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((r, i) => (
              <tr key={r.id} className="align-middle">
                <td className="px-3 py-2 font-semibold text-gray-500">{view === "classifica" ? r.position : i + 1}</td>
                <td className="px-3 py-2">
                  <Link href={`/app/progetti/${project.id}/aziende/${r.id}`} className="font-medium hover:text-accent">
                    {r.name}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <span className="text-base font-bold">{r.analysis!.total_score}</span>
                  <span className="text-xs text-gray-500">/100</span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex w-48 flex-col gap-1">
                    {criteria.map((c) => {
                      const s = r.analysis!.scores?.find((x) => x.criterion_id === c.id)?.score;
                      return (
                        <div key={c.id} className="flex items-center gap-2" title={`${c.name}: ${s ?? "—"}/10`}>
                          <ScoreBar value={s ?? 0} max={10} className="h-1.5" />
                          <span className="w-4 text-right text-[10px] text-gray-500">{s ?? "–"}</span>
                        </div>
                      );
                    })}
                  </div>
                </td>
                <td className="px-3 py-2"><StatusSelect companyId={r.id} value={r.status} /></td>
                <td className="px-3 py-2">{r.report?.view_count ?? 0}</td>
                <td className="px-3 py-2">{r.report && <CopyButton text={`${siteUrl}/r/${r.report.slug}`} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > analyzed.length && (
        <p className="text-xs text-gray-500">{rows.length - analyzed.length} aziende non ancora analizzate non compaiono in classifica.</p>
      )}
    </div>
  );
}
