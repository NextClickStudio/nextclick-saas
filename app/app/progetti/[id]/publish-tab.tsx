"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/client-utils";
import { CopyButton } from "@/components/company-controls";
import { Card, ErrorBox, btn, input, label } from "@/components/ui";
import type { TabProps } from "./tabs";

export default function PublishTab({ project, siteUrl }: TabProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    public_ranking_enabled: project.public_ranking_enabled,
    public_top_n: project.public_top_n,
    report_cta_text: project.report_cta_text,
    report_cta_url: project.report_cta_url ?? "",
    sender_name: project.sender_name ?? "",
  });
  const [state, setState] = useState<"" | "saving" | "saved">("");
  const [error, setError] = useState("");
  const publicUrl = `${siteUrl}/classifica/${project.public_slug}`;

  async function save() {
    setState("saving");
    setError("");
    try {
      await api(`/api/admin/projects/${project.id}`, { method: "PATCH", body: form });
      setState("saved");
      router.refresh();
      setTimeout(() => setState(""), 2000);
    } catch (err) {
      setError((err as Error).message);
      setState("");
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="space-y-4">
        <h2 className="font-semibold">Classifica pubblica</h2>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--color-accent)]"
            checked={form.public_ranking_enabled}
            onChange={(e) => setForm({ ...form, public_ranking_enabled: e.target.checked })}
          />
          Pubblica la classifica (mostra solo le prime N aziende)
        </label>
        <div>
          <label className={label} htmlFor="topn">Quante aziende mostrare (top N)</label>
          <input
            id="topn"
            type="number"
            min={1}
            max={100}
            className={`${input} w-28`}
            value={form.public_top_n}
            onChange={(e) => setForm({ ...form, public_top_n: Number(e.target.value) })}
          />
        </div>
        <div>
          <p className={label}>Link alla classifica pubblica</p>
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
            <span className="break-all text-gray-700">{publicUrl}</span>
            <CopyButton text={publicUrl} />
            {project.public_ranking_enabled && (
              <a href={publicUrl} target="_blank" className="text-xs font-medium text-accent hover:underline">Apri</a>
            )}
          </div>
          {!project.public_ranking_enabled && (
            <p className="mt-1 text-xs text-gray-500">Finché la classifica non è pubblicata, il link mostra &quot;pagina non trovata&quot;.</p>
          )}
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Report privati</h2>
        <div>
          <label className={label} htmlFor="cta">Testo della CTA finale</label>
          <input id="cta" className={input} value={form.report_cta_text} onChange={(e) => setForm({ ...form, report_cta_text: e.target.value })} />
        </div>
        <div>
          <label className={label} htmlFor="ctaurl">URL della CTA (es. link Calendly)</label>
          <input
            id="ctaurl"
            className={input}
            placeholder="https://calendly.com/nextclick/15min"
            value={form.report_cta_url}
            onChange={(e) => setForm({ ...form, report_cta_url: e.target.value })}
          />
        </div>
        <div>
          <label className={label} htmlFor="sender">Nome del mittente</label>
          <input
            id="sender"
            className={input}
            placeholder="Mario Rossi, NextClick Studio"
            value={form.sender_name}
            onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
          />
        </div>
      </Card>

      <ErrorBox>{error}</ErrorBox>
      <button className={btn.primary} onClick={save} disabled={state === "saving"}>
        {state === "saving" ? "Salvataggio…" : state === "saved" ? "Salvato ✓" : "Salva"}
      </button>
    </div>
  );
}
