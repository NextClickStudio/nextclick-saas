"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ErrorBox, btn, input, label } from "@/components/ui";
import { api } from "@/components/client-utils";

export default function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/login", { body: { password } });
      const next = params.get("next");
      // solo percorsi interni, per evitare redirect verso altri siti
      window.location.href = next && next.startsWith("/app") ? next : "/app";
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="password" className={label}>
          Password
        </label>
        <input
          id="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          className={input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <ErrorBox>{error}</ErrorBox>
      <button type="submit" className={`${btn.primary} w-full`} disabled={loading || !password}>
        {loading ? "Accesso in corso…" : "Entra"}
      </button>
    </form>
  );
}
