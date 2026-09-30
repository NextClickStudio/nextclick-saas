"use client";

// Controlli riusati nelle tabelle: stato commerciale, note, stato analisi, copia link.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, copyText } from "@/components/client-utils";
import { COMPANY_STATUSES, type CompanyRow } from "@/lib/types";

export function StatusSelect({ companyId, value }: { companyId: string; value: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [saving, setSaving] = useState(false);

  async function change(next: string) {
    const prev = current;
    setCurrent(next);
    setSaving(true);
    try {
      await api(`/api/admin/companies/${companyId}`, { method: "PATCH", body: { status: next } });
      router.refresh();
    } catch (err) {
      setCurrent(prev);
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm disabled:opacity-60"
      value={current}
      disabled={saving}
      onChange={(e) => change(e.target.value)}
    >
      {COMPANY_STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

export function NotesInput({ companyId, value, multiline = false }: { companyId: string; value: string | null; multiline?: boolean }) {
  const [text, setText] = useState(value ?? "");
  const [state, setState] = useState<"" | "saving" | "saved" | "error">("");

  async function save() {
    if (text === (value ?? "")) return;
    setState("saving");
    try {
      await api(`/api/admin/companies/${companyId}`, { method: "PATCH", body: { notes: text } });
      setState("saved");
      setTimeout(() => setState(""), 1500);
    } catch {
      setState("error");
    }
  }

  const cls = `w-full rounded-md border px-2 py-1 text-sm focus:border-accent focus:outline-none ${
    state === "error" ? "border-red-400" : "border-transparent hover:border-gray-300 bg-transparent"
  }`;
  return (
    <div className="relative">
      {multiline ? (
        <textarea
          rows={4}
          className={`${cls} border-gray-300 bg-white`}
          placeholder="Aggiungi una nota…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
        />
      ) : (
        <input
          className={cls}
          placeholder="Aggiungi nota…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      )}
      {state && (
        <span className={`text-xs ${state === "error" ? "text-red-600" : "text-gray-500"}`}>
          {state === "saving" ? "Salvataggio…" : state === "saved" ? "Salvata" : "Non salvata, riprova"}
        </span>
      )}
    </div>
  );
}

export function AnalysisBadge({ row }: { row: CompanyRow }) {
  const last = row.lastAttempt;
  if (!last) return <span className="text-xs text-gray-500">Non analizzata</span>;
  if (last.status === "in_corso") return <span className="text-xs font-medium text-amber-700">In corso…</span>;
  if (last.status === "errore")
    return (
      <span className="text-xs font-medium text-red-700" title={last.error_message ?? ""}>
        Errore{row.analysis ? " (vale l'analisi precedente)" : ""}
      </span>
    );
  return <span className="text-xs font-medium text-emerald-700">Completata</span>;
}

export function CopyButton({ text, label = "Copia link" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft"
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } else {
          prompt("Copia il link:", text);
        }
      }}
    >
      {done ? "Copiato ✓" : label}
    </button>
  );
}
