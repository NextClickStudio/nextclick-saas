"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/client-utils";
import { btn } from "@/components/ui";

export default function ReanalyzeButton({ companyId, label }: { companyId: string; label: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    setLoading(true);
    setMessage("");
    try {
      const res = await api<{ ok: boolean; error?: string }>("/api/admin/analyze", { body: { companyId } });
      if (!res.ok) setMessage(res.error || "Analisi non riuscita.");
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-right">
      <button className={btn.secondary} onClick={run} disabled={loading}>
        {loading ? "Analisi in corso… (fino a 60 s)" : label}
      </button>
      {message && <p className="mt-1 max-w-xs text-xs text-red-700">{message}</p>}
    </div>
  );
}
