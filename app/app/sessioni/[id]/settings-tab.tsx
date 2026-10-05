"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CriteriaEditor from "@/components/criteria-editor";
import { api } from "@/components/client-utils";
import { Card, ErrorBox, btn, input, label } from "@/components/ui";
import type { CriterionDraft } from "@/lib/types";
import type { TabProps } from "./tabs";

export default function SettingsTab({ project, criteria, rows }: TabProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: project.name,
    product_description: project.product_description,
    target_customer: project.target_customer,
    target_sector: project.target_sector,
    symptom: project.symptom ?? "",
    index_name: project.index_name ?? "",
  });
  const [list, setList] = useState<CriterionDraft[]>(
    criteria.map((c) => ({ id: c.id, name: c.name, description: c.description, how_to_check: c.how_to_check, weight: c.weight })),
  );
  const [state, setState] = useState<"" | "saving" | "saved" | "deleting">("");
  const [error, setError] = useState("");
  const analyzedCount = rows.filter((r) => r.analysis).length;

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  async function save() {
    setState("saving");
    setError("");
    try {
      await api(`/api/app/projects/${project.id}`, { method: "PATCH", body: { ...form, criteria: list } });
      setState("saved");
      router.refresh();
      setTimeout(() => setState(""), 2000);
    } catch (err) {
      setError((err as Error).message);
      setState("");
    }
  }

  async function remove() {
    const answer = prompt(`Per eliminare definitivamente il progetto e tutte le sue aziende, analisi e report scrivi: ELIMINA`);
    if (answer !== "ELIMINA") return;
    setState("deleting");
    try {
      await api(`/api/app/projects/${project.id}`, { method: "DELETE" });
      router.push("/app");
    } catch (err) {
      setError((err as Error).message);
      setState("");
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card className="space-y-4">
        <div>
          <label className={label} htmlFor="s-name">Nome progetto</label>
          <input id="s-name" className={input} value={form.name} onChange={set("name")} />
        </div>
        <div>
          <label className={label} htmlFor="s-product">Cosa vendi</label>
          <textarea id="s-product" rows={3} className={input} value={form.product_description} onChange={set("product_description")} />
        </div>
        <div>
          <label className={label} htmlFor="s-customer">A chi lo vendi</label>
          <textarea id="s-customer" rows={2} className={input} value={form.target_customer} onChange={set("target_customer")} />
        </div>
        <div>
          <label className={label} htmlFor="s-sector">Settore delle aziende target</label>
          <input id="s-sector" className={input} value={form.target_sector} onChange={set("target_sector")} />
        </div>
        <div>
          <label className={label} htmlFor="s-symptom">Sintomo visibile</label>
          <textarea id="s-symptom" rows={3} className={input} value={form.symptom} onChange={set("symptom")} />
        </div>
        <div>
          <label className={label} htmlFor="s-index">Nome della classifica pubblica</label>
          <input id="s-index" className={input} placeholder="Indice della consulenza online" value={form.index_name} onChange={set("index_name")} />
        </div>
      </Card>

      <div>
        <h2 className="mb-1 font-semibold">Criteri</h2>
        {analyzedCount > 0 && (
          <p className="mb-3 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
            Attenzione: se cambi i criteri, le {analyzedCount} analisi già fatte restano calcolate sui criteri vecchi.
            Dopo il salvataggio usa &quot;Rianalizza&quot; nella tab Analisi.
          </p>
        )}
        <CriteriaEditor criteria={list} onChange={setList} />
      </div>

      <ErrorBox>{error}</ErrorBox>
      <button className={btn.primary} onClick={save} disabled={state === "saving"}>
        {state === "saving" ? "Salvataggio…" : state === "saved" ? "Salvato ✓" : "Salva modifiche"}
      </button>

      <Card className="border-red-500/30">
        <h2 className="mb-1 font-semibold text-red-300">Elimina progetto</h2>
        <p className="mb-3 text-sm text-zinc-400">Elimina il progetto con tutte le aziende, le analisi e i report. Non si può annullare.</p>
        <button className={btn.danger} onClick={remove} disabled={state === "deleting"}>
          {state === "deleting" ? "Eliminazione…" : "Elimina progetto"}
        </button>
      </Card>
    </div>
  );
}
