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
      await api(`/api/app/companies/${companyId}`, { method: "PATCH", body: { status: next } });
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
      className="rounded-lg border border-white/[0.12] bg-panel px-2 py-1.5 text-sm text-zinc-200 disabled:opacity-60"
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
      await api(`/api/app/companies/${companyId}`, { method: "PATCH", body: { notes: text } });
      setState("saved");
      setTimeout(() => setState(""), 1500);
    } catch {
      setState("error");
    }
  }

  const cls = `w-full rounded-md border px-2 py-1 text-sm focus:border-accent focus:outline-none ${
    state === "error" ? "border-red-400" : "border-transparent hover:border-white/[0.12] bg-transparent"
  }`;
  return (
    <div className="relative">
      {multiline ? (
        <textarea
          rows={4}
          className={`${cls} border-white/[0.12] bg-white/[0.03]`}
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
        <span className={`text-xs ${state === "error" ? "text-red-400" : "text-zinc-500"}`}>
          {state === "saving" ? "Salvataggio…" : state === "saved" ? "Salvata" : "Non salvata, riprova"}
        </span>
      )}
    </div>
  );
}

function isStale(iso: string): boolean {
  return new Date(iso).getTime() < Date.now() - 3 * 60 * 1000;
}

export function AnalysisBadge({ row }: { row: CompanyRow }) {
  const last = row.lastAttempt;
  if (!last) return <span className="text-xs text-zinc-500">Non analizzata</span>;
  if (last.status === "in_corso") {
    // un'analisi "in corso" da più di 3 minuti è stata interrotta (pagina chiusa o tempo scaduto)
    const stale = isStale(last.created_at);
    return stale ? (
      <span className="text-xs font-medium text-red-300">Interrotta · rianalizza</span>
    ) : (
      <span className="text-xs font-medium text-amber-300">In corso…</span>
    );
  }
  if (last.status === "errore")
    return (
      <span className="text-xs font-medium text-red-300" title={last.error_message ?? ""}>
        Errore{row.analysis ? " (vale l'analisi precedente)" : ""}
      </span>
    );
  return <span className="text-xs font-medium text-emerald-300">Completata</span>;
}

export function CopyButton({ text, label = "Copia link" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="rounded-md px-2 py-1 text-xs font-medium text-[#c4b8ff] hover:bg-accent-soft"
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
