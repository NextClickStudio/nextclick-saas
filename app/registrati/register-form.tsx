"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/components/client-utils";
import { ErrorBox, btn, input, label } from "@/components/ui";

export default function RegisterForm() {
  const [form, setForm] = useState({ full_name: "", company_name: "", email: "", password: "" });
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/register", { body: { ...form, accept_terms: accept } });
      // ricarica completa voluta: così la pagina legge i nuovi cookie di login
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/app";
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={label}>Nome e cognome</label>
          <input id="name" required autoComplete="name" className={input} value={form.full_name} onChange={set("full_name")} />
        </div>
        <div>
          <label htmlFor="company" className={label}>Azienda <span className="text-zinc-600">(facoltativo)</span></label>
          <input id="company" autoComplete="organization" className={input} value={form.company_name} onChange={set("company_name")} />
        </div>
      </div>
      <div>
        <label htmlFor="email" className={label}>Email di lavoro</label>
        <input id="email" type="email" required autoComplete="email" className={input} value={form.email} onChange={set("email")} />
      </div>
      <div>
        <label htmlFor="password" className={label}>Password</label>
        <input id="password" type="password" required minLength={8} autoComplete="new-password" className={input} value={form.password} onChange={set("password")} />
        <p className="mt-1 text-xs text-zinc-600">Almeno 8 caratteri.</p>
      </div>
      <label className="flex items-start gap-3 text-sm text-zinc-400">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#8b7bff]" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        <span>
          Accetto i <Link href="/termini" target="_blank" className="text-[#c4b8ff] underline">Termini e condizioni</Link> e dichiaro di aver letto la{" "}
          <Link href="/privacy" target="_blank" className="text-[#c4b8ff] underline">Privacy policy</Link>. Uso Yeppo per la mia attività professionale.
        </span>
      </label>
      <ErrorBox>{error}</ErrorBox>
      <button type="submit" className={`${btn.accent} w-full !py-3`} disabled={loading || !accept}>
        {loading ? "Creazione account…" : "Crea account gratis"}
      </button>
    </form>
  );
}
