"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/client-utils";
import { AnalysisBadge, CopyButton, NotesInput, StatusSelect } from "@/components/company-controls";
import { Card, EmptyState, ErrorBox, btn, input } from "@/components/ui";
import { parseCompanyList, type ParseResult } from "@/lib/url";
import type { TabProps } from "./tabs";

const MAX_IMPORT = 200;

export default function CompaniesTab({ project, rows, siteUrl }: TabProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function makePreview(source: string) {
    const result = parseCompanyList(source);
    // segna come duplicati anche i siti già presenti nel progetto
    const existing = new Set(rows.map((r) => r.website_url));
    const already = result.companies.filter((c) => existing.has(c.url));
    result.companies = result.companies.filter((c) => !existing.has(c.url));
    result.duplicates.push(...already.map((c) => `${c.name}, ${c.url} (già nel progetto)`));
    setPreview(result);
    setMessage("");
    setError(result.companies.length > MAX_IMPORT ? `Puoi importare al massimo ${MAX_IMPORT} aziende per volta.` : "");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
    makePreview(content);
    e.target.value = "";
  }

  async function doImport() {
    if (!preview) return;
    setLoading(true);
    setError("");
    try {
      const res = await api<{ imported: number; skipped: number }>("/api/admin/import", {
        body: { projectId: project.id, companies: preview.companies },
      });
      setMessage(`Importate ${res.imported} aziende${res.skipped ? ` (${res.skipped} saltate perché duplicate o non valide)` : ""}.`);
      setText("");
      setPreview(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Eliminare "${name}" e le sue analisi?`)) return;
    try {
      await api(`/api/admin/companies/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-1 font-semibold">Importa aziende</h2>
        <p className="mb-3 text-sm text-gray-600">
          Una per riga nel formato <code className="rounded bg-gray-100 px-1">Nome, https://sito.it</code>, oppure carica
          un CSV con colonne <code className="rounded bg-gray-100 px-1">nome,url</code>. Massimo {MAX_IMPORT} per volta.
        </p>
        <textarea
          className={`${input} font-mono`}
          rows={5}
          placeholder={"Erboristeria Rossi, erboristeriarossi.it\nBeauty Shop Milano, https://www.beautyshopmilano.it\nIntegra Bio, integrabio.com"}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
          }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className={btn.secondary} onClick={() => makePreview(text)} disabled={!text.trim()}>
            Anteprima
          </button>
          <label className={`${btn.ghost} cursor-pointer`}>
            Carica CSV
            <input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={onFile} />
          </label>
        </div>

        {preview && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
            <p className="mb-2 font-medium">
              {preview.companies.length} aziende pronte da importare
              {preview.duplicates.length > 0 && ` · ${preview.duplicates.length} duplicate scartate`}
              {preview.invalid.length > 0 && ` · ${preview.invalid.length} righe non valide`}
            </p>
            {preview.companies.length > 0 && (
              <ul className="mb-2 max-h-48 overflow-y-auto text-gray-700">
                {preview.companies.map((c) => (
                  <li key={c.url} className="truncate">
                    {c.name} — <span className="text-gray-500">{c.url}</span>
                  </li>
                ))}
              </ul>
            )}
            {preview.invalid.length > 0 && (
              <details className="mb-2 text-red-700">
                <summary className="cursor-pointer">Righe non valide</summary>
                <ul className="mt-1">
                  {preview.invalid.map((l, i) => (
                    <li key={i} className="truncate">{l}</li>
                  ))}
                </ul>
              </details>
            )}
            {preview.duplicates.length > 0 && (
              <details className="mb-2 text-gray-600">
                <summary className="cursor-pointer">Duplicate</summary>
                <ul className="mt-1">
                  {preview.duplicates.map((l, i) => (
                    <li key={i} className="truncate">{l}</li>
                  ))}
                </ul>
              </details>
            )}
            <button
              className={btn.primary}
              onClick={doImport}
              disabled={loading || preview.companies.length === 0 || preview.companies.length > MAX_IMPORT}
            >
              {loading ? "Importazione…" : `Importa ${preview.companies.length} aziende`}
            </button>
          </div>
        )}
        <div className="mt-3 space-y-2">
          <ErrorBox>{error}</ErrorBox>
          {message && <p className="text-sm text-emerald-700">{message}</p>}
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState>Nessuna azienda ancora: incollane una lista qui sopra.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Azienda</th>
                <th className="px-3 py-2">Analisi</th>
                <th className="px-3 py-2">Punteggio</th>
                <th className="px-3 py-2">Stato commerciale</th>
                <th className="px-3 py-2">Note</th>
                <th className="px-3 py-2">Report</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-2">
                    <Link href={`/app/progetti/${project.id}/aziende/${r.id}`} className="font-medium text-gray-950 hover:text-accent">
                      {r.name}
                    </Link>
                    <a href={r.website_url} target="_blank" rel="noopener noreferrer" className="block max-w-[220px] truncate text-xs text-gray-500 hover:underline">
                      {r.website_url.replace(/^https?:\/\//, "")}
                    </a>
                  </td>
                  <td className="px-3 py-2"><AnalysisBadge row={r} /></td>
                  <td className="px-3 py-2 font-semibold">{r.analysis ? `${r.analysis.total_score}/100` : "—"}</td>
                  <td className="px-3 py-2"><StatusSelect companyId={r.id} value={r.status} /></td>
                  <td className="px-3 py-2 min-w-[180px]"><NotesInput companyId={r.id} value={r.notes} /></td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.report ? (
                      <>
                        <a href={`/r/${r.report.slug}`} target="_blank" className="text-xs font-medium text-accent hover:underline">Apri</a>
                        <CopyButton text={`${siteUrl}/r/${r.report.slug}`} />
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button className="text-xs text-gray-400 hover:text-red-600" onClick={() => remove(r.id, r.name)} aria-label="Elimina">
                      Elimina
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
