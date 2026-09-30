"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CriteriaEditor from "@/components/criteria-editor";
import { api } from "@/components/client-utils";
import { Card, ErrorBox, btn, input, label } from "@/components/ui";
import { EXAMPLE, type CriterionDraft } from "@/lib/types";

type Generated = { symptom: string; index_name: string; criteria: CriterionDraft[] };

export default function NewProjectWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ name: "", product_description: "", target_customer: "", target_sector: "" });
  const [symptom, setSymptom] = useState("");
  const [indexName, setIndexName] = useState("");
  const [criteria, setCriteria] = useState<CriterionDraft[]>([]);
  const [loading, setLoading] = useState<"" | "generate" | "save">("");
  const [error, setError] = useState("");

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const step1Valid =
    form.name.trim() && form.product_description.trim().length >= 10 && form.target_customer.trim() && form.target_sector.trim();

  async function generate() {
    setLoading("generate");
    setError("");
    try {
      const data = await api<Generated>("/api/admin/criteria", { body: form });
      setSymptom(data.symptom);
      setIndexName(data.index_name);
      setCriteria(data.criteria);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading("");
    }
  }

  async function save() {
    setLoading("save");
    setError("");
    try {
      const { id } = await api<{ id: string }>("/api/admin/projects", {
        body: { ...form, symptom, index_name: indexName, criteria },
      });
      router.push(`/app/progetti/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setLoading("");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Nuovo progetto</h1>
      <p className="mb-6 text-sm text-gray-600">Passo {step} di 2 · {step === 1 ? "Cosa vendi e a chi" : "Sintomo e criteri"}</p>

      {step === 1 && (
        <Card className="space-y-4">
          <div>
            <label className={label} htmlFor="name">Nome progetto</label>
            <input id="name" className={input} placeholder={EXAMPLE.name} value={form.name} onChange={set("name")} />
          </div>
          <div>
            <label className={label} htmlFor="product">Cosa vendi</label>
            <textarea id="product" rows={3} className={input} placeholder={EXAMPLE.product} value={form.product_description} onChange={set("product_description")} />
          </div>
          <div>
            <label className={label} htmlFor="customer">A chi lo vendi</label>
            <textarea id="customer" rows={2} className={input} placeholder={EXAMPLE.customer} value={form.target_customer} onChange={set("target_customer")} />
          </div>
          <div>
            <label className={label} htmlFor="sector">Settore delle aziende target</label>
            <input id="sector" className={input} placeholder={EXAMPLE.sector} value={form.target_sector} onChange={set("target_sector")} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              className={btn.ghost}
              onClick={() =>
                setForm({ name: EXAMPLE.name, product_description: EXAMPLE.product, target_customer: EXAMPLE.customer, target_sector: EXAMPLE.sector })
              }
            >
              Usa l&apos;esempio NextClick
            </button>
            <button type="button" className={btn.primary} disabled={!step1Valid} onClick={() => setStep(2)}>
              Avanti →
            </button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <Card>
            <p className="mb-4 text-sm text-gray-600">
              L&apos;AI cerca il <strong>sintomo visibile</strong>: il segnale, osservabile dall&apos;esterno sul sito di
              un&apos;azienda, che indica che ha il problema che risolvi. Poi lo trasforma in criteri misurabili.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn.primary} onClick={generate} disabled={loading !== ""}>
                {loading === "generate" ? "Sto cercando il sintomo… (circa 20 secondi)" : criteria.length ? "Rigenera" : "Trova il sintomo"}
              </button>
              <button type="button" className={btn.secondary} onClick={() => setStep(1)} disabled={loading !== ""}>
                ← Indietro
              </button>
            </div>
          </Card>

          <ErrorBox>{error}</ErrorBox>

          {criteria.length > 0 && (
            <>
              <Card className="space-y-4">
                <div>
                  <label className={label} htmlFor="symptom">Sintomo visibile</label>
                  <textarea id="symptom" rows={3} className={input} value={symptom} onChange={(e) => setSymptom(e.target.value)} />
                </div>
                <div>
                  <label className={label} htmlFor="index">Nome della classifica pubblica</label>
                  <input id="index" className={input} value={indexName} onChange={(e) => setIndexName(e.target.value)} />
                </div>
              </Card>

              <div>
                <h2 className="mb-1 font-semibold">Criteri</h2>
                <p className="mb-3 text-sm text-gray-600">
                  Punteggio alto = l&apos;azienda è già brava (sintomo assente). Modifica, aggiungi o rimuovi liberamente.
                </p>
                <CriteriaEditor criteria={criteria} onChange={setCriteria} />
              </div>

              <div className="flex justify-end">
                <button type="button" className={btn.primary} onClick={save} disabled={loading !== "" || !symptom.trim()}>
                  {loading === "save" ? "Salvataggio…" : "Salva progetto"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
