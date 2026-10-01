"use client";

// Cerca su Google founder, marketing e commerciale dell'azienda e li aggiunge ai contatti.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/client-utils";
import { btn } from "@/components/ui";

export default function FindPeopleButton({ companyId, small = false }: { companyId: string; small?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    setLoading(true);
    setMessage("");
    try {
      const res = await api<{ found: number }>(`/api/app/companies/${companyId}/people`, { body: {} });
      setMessage(res.found > 0 ? `Trovate ${res.found} ${res.found === 1 ? "persona" : "persone"}.` : "Nessuna persona trovata sul web.");
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={small ? "" : "text-right"}>
      <button className={small ? btn.ghost : btn.secondary} onClick={run} disabled={loading}>
        {loading ? "Cerco su Google…" : "🔎 Cerca persone sul web"}
      </button>
      {message && <p className="mt-1 max-w-xs text-xs text-zinc-400">{message}</p>}
    </div>
  );
}
