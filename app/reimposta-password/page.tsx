"use client";

import { useState } from "react";
import AuthShell from "@/components/auth-shell";
import { api } from "@/components/client-utils";
import { ErrorBox, btn, input, label } from "@/components/ui";

export default function ResetPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/update-password", { body: { password } });
      // ricarica completa voluta: così la pagina legge i nuovi cookie di login
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/app";
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Nuova password" subtitle="Scegli una nuova password per il tuo account.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className={label}>Nuova password</label>
          <input id="password" type="password" minLength={8} required autoComplete="new-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <ErrorBox>{error}</ErrorBox>
        <button type="submit" className={`${btn.primary} w-full !py-3`} disabled={loading}>
          {loading ? "Salvataggio…" : "Salva e accedi"}
        </button>
      </form>
    </AuthShell>
  );
}
