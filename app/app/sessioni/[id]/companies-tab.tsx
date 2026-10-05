"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/client-utils";
import { AnalysisBadge, CopyButton, NotesInput, StatusSelect } from "@/components/company-controls";
import { Badge, Card, EmptyState, ErrorBox, btn, input } from "@/components/ui";
import { parseCompanyList, type ParseResult } from "@/lib/url";
import type { TabProps } from "./tabs";

const SEARCH_MESSAGES = [
  "Cerco aziende del tuo settore sul web…",
  "Filtro marketplace, directory e siti non pertinenti…",
  "Verifico che ogni sito esista e risponda…",
  "Stimo dimensione e potenziale di ogni azienda…",
];

export default function CompaniesTab({
  project,
  rows,
  siteUrl,
  autoDiscover,
  goTo,
}: TabProps & { autoDiscover?: boolean; goTo: (tab: "analisi") => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<"" | "import" | "discover" | "start">("");
  const [searchStep, setSearchStep] = useState(0);
  const autoStarted = useRef(false);

  const started = Boolean(project.credit_used_at);
  const room = project.company_limit - rows.length;

  async function startSession() {
    setLoading("start");
    setError("");
    try {
      await api(`/api/app/projects/${project.id}/start`, { body: {} });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading("");
    }
  }

  async function discover() {
    setLoading("discover");
    setError("");
    setMessage("");
    setSearchStep(0);
    const timer = setInterval(() => setSearchStep((s) => Math.min(s + 1, SEARCH_MESSAGES.length - 1)), 9000);
    try {
      const res = await api<{ found: number; discarded: number; duplicates: number; remaining: number }>(
        `/api/app/projects/${project.id}/discover`,
        { body: {} },
      );
      const extra = [
        res.duplicates ? `${res.duplicates} già presenti nelle tue sessioni` : "",
        res.discarded ? `${res.discarded} con sito non raggiungibile` : "",
      ].filter(Boolean);
      setMessage(
        res.found > 0
          ? `Trovate ${res.found} nuove aziende verificate${extra.length ? ` (scartate: ${extra.join(", ")})` : ""}.`
          : "Nessuna nuova azienda verificata questa volta. Riprova o aggiungine qualcuna a mano.",
      );
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      clearInterval(timer);
      setLoading("");
    }
  }

  // appena avviata la sessione, la ricerca parte da sola
  useEffect(() => {
    if (autoDiscover && started && rows.length === 0 && !autoStarted.current) {
      autoStarted.current = true;
      void discover();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDiscover, started, rows.length]);

  function makePreview(source: string) {
    const result = parseCompanyList(source);
    const existing = new Set(rows.map((r) => r.website_url));
    const already = result.companies.filter((c) => existing.has(c.url));
    result.companies = result.companies.filter((c) => !existing.has(c.url));
    result.duplicates.push(...already.map((c) => `${c.name}, ${c.url} (già nella sessione)`));
    setPreview(result);
    setMessage("");
    setError(result.companies.length > room ? `Puoi aggiungere ancora ${Math.max(0, room)} aziende in questa sessione.` : "");
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
    setLoading("import");
    setError("");
    try {
      const res = await api<{ imported: number; skipped: number }>("/api/app/import", {
        body: { projectId: project.id, companies: preview.companies },
      });
      setMessage(`Aggiunte ${res.imported} aziende${res.skipped ? ` (${res.skipped} saltate: duplicate, non valide o oltre il limite)` : ""}.`);
      setText("");
      setPreview(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading("");
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Eliminare "${name}" e le sue analisi?`)) return;
    try {
      await api(`/api/app/companies/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  if (!started) {
    return (
      <Card className="mx-auto max-w-xl p-8 text-center">
        <h2 className="font-display text-xl font-semibold text-white">Sessione non ancora avviata</h2>
        <p className="mt-2 text-sm text-zinc-400">Avviala per usare 1 sessione: Yeppo cercherà subito le aziende per te.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button className={btn.accent} onClick={startSession} disabled={loading !== ""}>
            {loading === "start" ? "Avvio…" : "Avvia la sessione"}
          </button>
          <Link href="/app/piani" className={btn.secondary}>Piani</Link>
        </div>
        <div className="mt-4">
          <ErrorBox>{error}</ErrorBox>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* RICERCA AUTOMATICA */}
      <div className="glow-border relative overflow-hidden rounded-3xl bg-panel p-6">
        {loading === "discover" && (
          <div className="scanline pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-accent/20 to-transparent" />
        )}
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">Ricerca automatica</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {rows.length}/{project.company_limit} aziende in questa sessione
              {room > 0 ? ` · puoi trovarne ancora ${room}` : " · limite raggiunto"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={btn.accent} onClick={discover} disabled={loading !== "" || room <= 0}>
              {loading === "discover" ? "Ricerca in corso…" : rows.length === 0 ? "Trova le aziende" : "Trova altre aziende"}
            </button>
            {rows.length > 0 && (
              <button className={btn.secondary} onClick={() => goTo("analisi")}>
                Vai all&apos;analisi →
              </button>
            )}
          </div>
        </div>
        {loading === "discover" && (
          <div className="relative mt-5 flex items-center gap-3 text-sm text-[#d6ceff]">
            <span className="pulse-dot h-2 w-2 rounded-full bg-cyan" />
            <span key={searchStep} className="fade-in">{SEARCH_MESSAGES[searchStep]}</span>
            <span className="text-zinc-600">(30-60 secondi)</span>
          </div>
        )}
        <div className="relative mt-4 space-y-2">
          <ErrorBox>{error}</ErrorBox>
          {message && <p className="text-sm text-emerald-300">{message}</p>}
        </div>
      </div>

      {/* AGGIUNTA MANUALE */}
      <details className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-zinc-200">
          Aggiungi aziende a mano
          <span className="text-zinc-500 transition-transform group-open:rotate-45">+</span>
        </summary>
        <p className="mb-3 mt-3 text-sm text-zinc-500">
          Una per riga nel formato <code className="rounded bg-white/[0.07] px-1">Nome, https://sito.it</code>, oppure carica un CSV con colonne{" "}
          <code className="rounded bg-white/[0.07] px-1">nome,url</code>.
        </p>
        <textarea
          className={`${input} font-mono`}
          rows={4}
          placeholder={"Atelier Rossi, atelierrossi.it\nNordic Shoes, https://www.nordicshoes.com"}
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
          <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-sm">
            <p className="mb-2 font-medium text-white">
              {preview.companies.length} aziende pronte
              {preview.duplicates.length > 0 && ` · ${preview.duplicates.length} duplicate`}
              {preview.invalid.length > 0 && ` · ${preview.invalid.length} righe non valide`}
            </p>
            <ul className="mb-3 max-h-40 overflow-y-auto text-zinc-400">
              {preview.companies.map((c) => (
                <li key={c.url} className="truncate">{c.name} — <span className="text-zinc-600">{c.url}</span></li>
              ))}
            </ul>
            <button className={btn.primary} onClick={doImport} disabled={loading !== "" || preview.companies.length === 0 || room <= 0}>
              {loading === "import" ? "Aggiunta…" : `Aggiungi ${Math.min(preview.companies.length, Math.max(room, 0))} aziende`}
            </button>
          </div>
        )}
      </details>

      {/* TABELLA */}
      {rows.length === 0 ? (
        <EmptyState>Nessuna azienda ancora: avvia la ricerca automatica qui sopra.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.07] bg-white/[0.015]">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-white/[0.07] text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">Azienda</th>
                <th className="px-4 py-3">Analisi</th>
                <th className="px-4 py-3">Punteggio</th>
                <th className="px-4 py-3">Stato commerciale</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Report</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {rows.map((r) => (
                <tr key={r.id} className="align-top transition-colors hover:bg-white/[0.02]">
                  <td className="max-w-[280px] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/app/sessioni/${project.id}/aziende/${r.id}`} className="font-medium text-white hover:text-[#c4b8ff]">
                        {r.name}
                      </Link>
                      {r.size_estimate && <Badge>{r.size_estimate}</Badge>}
                    </div>
                    <a href={r.website_url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-zinc-500 hover:underline">
                      {r.website_url.replace(/^https?:\/\//, "")}
                    </a>
                    {r.discovery_reason && <p className="mt-1 line-clamp-2 text-xs text-zinc-600">{r.discovery_reason}</p>}
                  </td>
                  <td className="px-4 py-3"><AnalysisBadge row={r} /></td>
                  <td className="px-4 py-3 font-display text-base font-semibold text-white">{r.analysis ? `${r.analysis.total_score}` : "—"}</td>
                  <td className="px-4 py-3"><StatusSelect companyId={r.id} value={r.status} /></td>
                  <td className="min-w-[180px] px-4 py-3"><NotesInput companyId={r.id} value={r.notes} /></td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {r.report ? (
                      <>
                        <a href={`/r/${r.report.slug}`} target="_blank" className="text-xs font-medium text-[#c4b8ff] hover:underline">Apri</a>
                        <CopyButton text={`${siteUrl}/r/${r.report.slug}`} />
                      </>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-xs text-zinc-600 hover:text-red-400" onClick={() => remove(r.id, r.name)}>
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
