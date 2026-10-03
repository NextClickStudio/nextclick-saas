"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/components/client-utils";
import GoogleButton from "@/components/google-button";
import { EMAIL_AUTH_ENABLED } from "@/lib/config";
import { ErrorBox, btn, input, label } from "@/components/ui";

export default function LoginForm() {
  const params = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "" });
  const errorParam = params.get("errore");
  const [error, setError] = useState(
    errorParam === "google"
      ? `Accesso con Google non riuscito.${EMAIL_AUTH_ENABLED ? " Usa email e password." : " Riprova tra poco."}`
      : errorParam === "link"
        ? "Il link non è valido o è scaduto. Riprova."
        : "",
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/login", { body: form });
      const next = params.get("next");
      window.location.href = next && next.startsWith("/app") ? next : "/app";
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  if (!EMAIL_AUTH_ENABLED) {
    return (
      <div className="space-y-4">
        <GoogleButton next={params.get("next") ?? undefined} />
        <ErrorBox>{error}</ErrorBox>
      </div>
    );
  }

  return (
    <>
    <GoogleButton next={params.get("next") ?? undefined} />
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className={label}>Email</label>
        <input id="email" type="email" autoComplete="email" required className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className={label}>Password</label>
          <Link href="/password-dimenticata" className="mb-1.5 text-xs text-zinc-500 hover:text-white">Password dimenticata?</Link>
        </div>
        <input id="password" type="password" autoComplete="current-password" required className={input} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </div>
      <ErrorBox>{error}</ErrorBox>
      <button type="submit" className={`${btn.primary} w-full !py-3`} disabled={loading}>
        {loading ? "Accesso in corso…" : "Accedi"}
      </button>
    </form>
    </>
  );
}
