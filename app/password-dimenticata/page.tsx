"use client";

import Link from "next/link";
import { useState } from "react";
import AuthShell from "@/components/auth-shell";
import { api } from "@/components/client-utils";
import { ErrorBox, btn, input, label } from "@/components/ui";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/forgot", { body: { email } });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Recupera la password" subtitle="Ti inviamo un link per sceglierne una nuova." footer={<Link href="/login" className="hover:text-white">← Torna all&apos;accesso</Link>}>
      {sent ? (
        <p className="text-sm text-zinc-300">Se l&apos;email è registrata, riceverai a breve un link. Controlla anche lo spam.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className={label}>Email</label>
            <input id="email" type="email" required className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <ErrorBox>{error}</ErrorBox>
          <button type="submit" className={`${btn.primary} w-full !py-3`} disabled={loading}>
            {loading ? "Invio…" : "Invia link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
