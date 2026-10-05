"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CriteriaEditor from "@/components/criteria-editor";
import { api } from "@/components/client-utils";
import { Card, ErrorBox, btn, input, label } from "@/components/ui";
import { EXAMPLE, TARGET_SIZES, type CriterionDraft } from "@/lib/types";

type Generated = { symptom: string; index_name: string; criteria: CriterionDraft[] };

const STEP_NAMES = ["La tua offerta", "Sintomo e criteri", "Avvio"];

export default function NewSessionWizard({ available, limitLabel }: { available: number; limitLabel: string }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState({
    name: "",
    product_description: "",
    target_customer: "",
    target_sector: "",
    target_size: "tutte",
    target_country: "Italia",
  });
  const [symptom, setSymptom] = useState("");
  const [indexName, setIndexName] = useState("");
  const [criteria, setCriteria] = useState<CriterionDraft[]>([]);
  const [loading, setLoading] = useState<"" | "generate" | "start">("");
  const [error, setError] = useState("");

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const step1Valid =
    form.name.trim() && form.product_description.trim().length >= 10 && form.target_customer.trim() && form.target_sector.trim() && form.target_country.trim();

  async function generate() {
    setLoading("generate");
    setError("");
    try {
      const data = await api<Generated>("/api/app/criteria", { body: form });
      setSymptom(data.symptom);
      setIndexName(data.index_name);
      setCriteria(data.criteria);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading("");
    }
  }

  async function start() {
    setLoading("start");
    setError("");
    try {
      const { id } = await api<{ id: string }>("/api/app/projects", {
        body: { ...form, symptom, index_name: indexName, criteria },
      });
      await api(`/api/app/projects/${id}/start`, { body: {} });
      router.push(`/app/sessioni/${id}?avvia=1`);
    } catch (err) {
      setError((err as Error).message);
      setLoading("");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Nuova sessione</h1>

      {/* indicatore dei passi */}
      <ol className="mb-8 mt-6 flex gap-2">
        {STEP_NAMES.map((name, i) => (
          <li key={name} className="flex-1">
            <div className={`h-1 rounded-full ${i + 1 <= step ? "bg-gradient-to-r from-accent to-cyan" : "bg-white/[0.08]"}`} />
            <p className={`mt-2 text-xs ${i + 1 === step ? "text-white" : "text-zinc-600"}`}>
              {i + 1}. {name}
            </p>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <Card className="fade-in space-y-5 p-6">
          <div>
            <label className={label} htmlFor="name">Nome della sessione</label>
            <input id="name" className={input} placeholder={EXAMPLE.name} value={form.name} onChange={set("name")} />
          </div>
          <div>
            <label className={label} htmlFor="product">Cosa vendi</label>
            <textarea id="product" rows={3} className={input} placeholder={EXAMPLE.product} value={form.product_description} onChange={set("product_description")} />
          </div>
          <div>
            <label className={label} htmlFor="customer">A chi lo vendi (il tuo cliente ideale)</label>
            <textarea id="customer" rows={2} className={input} placeholder={EXAMPLE.customer} value={form.target_customer} onChange={set("target_customer")} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="sector">Settore delle aziende</label>
              <input id="sector" className={input} placeholder={EXAMPLE.sector} value={form.target_sector} onChange={set("target_sector")} />
            </div>
            <div>
              <label className={label} htmlFor="country">Area geografica</label>
              <input id="country" className={input} placeholder="Italia, Nord Italia, Spagna…" value={form.target_country} onChange={set("target_country")} />
            </div>
          </div>
          <div>
            <p className={label}>Dimensione delle aziende</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TARGET_SIZES.map((s) => (
                <button
                  type="button"
                  key={s.value}
                  onClick={() => setForm({ ...form, target_size: s.value })}
                  className={`rounded-xl border px-3 py-3 text-left transition-all ${
                    form.target_size === s.value ? "border-accent/60 bg-accent-soft" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <p className="text-sm font-medium text-white">{s.label}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{s.hint}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              className={btn.ghost}
              onClick={() =>
                setForm({
                  ...form,
                  name: EXAMPLE.name,
                  product_description: EXAMPLE.product,
                  target_customer: EXAMPLE.customer,
                  target_sector: EXAMPLE.sector,
                  target_country: EXAMPLE.country,
                })
              }
            >
              Compila con un esempio
            </button>
            <button type="button" className={btn.primary} disabled={!step1Valid} onClick={() => setStep(2)}>
              Avanti →
            </button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <div className="fade-in space-y-5">
          <Card className="p-6">
            <p className="mb-4 text-sm leading-relaxed text-zinc-400">
              L&apos;AI cerca il <strong className="text-white">sintomo visibile</strong>: il segnale, osservabile dall&apos;esterno sul sito
              di un&apos;azienda, che rivela che ha il problema che risolvi. Poi lo trasforma in criteri misurabili.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn.accent} onClick={generate} disabled={loading !== ""}>
                {loading === "generate" ? "Sto analizzando la tua offerta… (circa 20 s)" : criteria.length ? "Rigenera" : "Trova il sintomo"}
              </button>
              <button type="button" className={btn.secondary} onClick={() => setStep(1)} disabled={loading !== ""}>
                ← Indietro
              </button>
            </div>
          </Card>

          <ErrorBox>{error}</ErrorBox>

          {criteria.length > 0 && (
            <>
              <Card className="space-y-4 p-6">
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
                <h2 className="mb-1 font-semibold text-white">Criteri</h2>
                <p className="mb-3 text-sm text-zinc-500">Punteggio alto = l&apos;azienda è già brava (sintomo assente). Modificali liberamente.</p>
                <CriteriaEditor criteria={criteria} onChange={setCriteria} />
              </div>
              <div className="flex justify-end">
                <button type="button" className={btn.primary} onClick={() => setStep(3)} disabled={!symptom.trim() || criteria.length === 0}>
                  Avanti →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <Card className="fade-in space-y-6 p-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-white">Pronto a partire</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Yeppo cercherà sul web aziende <strong className="text-white">{TARGET_SIZES.find((s) => s.value === form.target_size)?.label.toLowerCase()}</strong>{" "}
              del settore <strong className="text-white">{form.target_sector}</strong> in <strong className="text-white">{form.target_country}</strong>,
              verificherà i loro siti e te li mostrerà. Poi potrai analizzarle e ottenere report e metodi di contatto.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-xs text-zinc-500">Costo</p>
              <p className="mt-1 font-semibold text-white">1 sessione</p>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-xs text-zinc-500">Aziende</p>
              <p className="mt-1 font-semibold text-white">{limitLabel}</p>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-xs text-zinc-500">Disponibili</p>
              <p className="mt-1 font-semibold text-white">{available === Infinity ? "Illimitate" : `${available} sessioni`}</p>
            </div>
          </div>
          <ErrorBox>{error}</ErrorBox>
          <div className="flex flex-wrap justify-between gap-3">
            <button type="button" className={btn.secondary} onClick={() => setStep(2)} disabled={loading !== ""}>
              ← Indietro
            </button>
            <button type="button" className={`${btn.accent} !px-6`} onClick={start} disabled={loading !== ""}>
              {loading === "start" ? "Avvio…" : "Avvia la sessione"}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
