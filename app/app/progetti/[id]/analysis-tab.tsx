"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/client-utils";
import { AnalysisBadge } from "@/components/company-controls";
import { Card, EmptyState, btn } from "@/components/ui";
import type { CompanyRow } from "@/lib/types";
import type { TabProps } from "./tabs";

type Result = { ok: boolean; total_score?: number; error?: string };
type LogLine = { name: string; ok: boolean; text: string };

export default function AnalysisTab({ rows }: TabProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [log, setLog] = useState<LogLine[]>([]);
  const stopRequested = useRef(false);
  const [stopping, setStopping] = useState(false);

  const notAnalyzed = rows.filter((r) => !r.analysis);

  // Analizza le aziende UNA ALLA VOLTA: ogni chiamata resta sotto i limiti di tempo di Vercel.
  async function runQueue(queue: CompanyRow[]) {
    if (queue.length === 0) return;
    stopRequested.current = false;
    setStopping(false);
    setRunning(true);
    setLog([]);
    setProgress({ done: 0, total: queue.length, current: queue[0].name });

    for (let i = 0; i < queue.length; i++) {
      if (stopRequested.current) break;
      const company = queue[i];
      setProgress({ done: i, total: queue.length, current: company.name });
      let line: LogLine;
      try {
        const res = await api<Result>("/api/admin/analyze", { body: { companyId: company.id } });
        line = res.ok
          ? { name: company.name, ok: true, text: `${res.total_score}/100` }
          : { name: company.name, ok: false, text: res.error || "Errore" };
      } catch (err) {
        line = { name: company.name, ok: false, text: (err as Error).message };
      }
      setLog((l) => [line, ...l]);
      setProgress({ done: i + 1, total: queue.length, current: "" });
      router.refresh();
    }
    setRunning(false);
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const errors = log.filter((l) => !l.ok).length;

  if (rows.length === 0) return <EmptyState>Nessuna azienda da analizzare: importale nella tab Aziende.</EmptyState>;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <button className={btn.primary} disabled={running || notAnalyzed.length === 0} onClick={() => runQueue(notAnalyzed)}>
            Analizza tutte le aziende non ancora analizzate ({notAnalyzed.length})
          </button>
          {running && (
            <button className={btn.secondary} onClick={() => {
                stopRequested.current = true;
                setStopping(true);
              }}>
              Interrompi
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Ogni azienda richiede circa 20-40 secondi. Tieni aperta questa pagina finché l&apos;analisi non è finita.
        </p>

        {(running || log.length > 0) && (
          <div className="mt-5">
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium">
                {progress.done}/{progress.total} analizzate
                {errors > 0 && <span className="text-red-700"> · {errors} errori</span>}
              </span>
              <span className="text-gray-500">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
            {running && progress.current && (
              <p className="mt-2 text-sm text-gray-600">
                In corso: <strong>{progress.current}</strong>
                {stopping && " (mi fermo dopo questa)"}
              </p>
            )}
            {!running && <p className="mt-2 text-sm text-gray-600">Processo terminato.</p>}
            {log.length > 0 && (
              <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto text-sm">
                {log.map((l, i) => (
                  <li key={i} className={l.ok ? "text-gray-700" : "text-red-700"}>
                    {l.ok ? "✓" : "✕"} {l.name}: {l.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Azienda</th>
              <th className="px-3 py-2">Stato analisi</th>
              <th className="px-3 py-2">Punteggio</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2">
                  <AnalysisBadge row={r} />
                  {r.lastAttempt?.status === "errore" && (
                    <p className="text-xs text-gray-500">{r.lastAttempt.error_message}</p>
                  )}
                </td>
                <td className="px-3 py-2 font-semibold">{r.analysis ? `${r.analysis.total_score}/100` : "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button className={btn.ghost} disabled={running} onClick={() => runQueue([r])}>
                    {r.analysis || r.lastAttempt ? "Rianalizza" : "Analizza"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
