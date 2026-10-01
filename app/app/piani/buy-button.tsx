"use client";

import { useState } from "react";
import { api } from "@/components/client-utils";
import { btn } from "@/components/ui";

export default function BuyButton({ planId, highlight, enabled }: { planId: string; highlight: boolean; enabled: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function buy() {
    setLoading(true);
    setError("");
    try {
      const { url } = await api<{ url: string }>("/api/app/checkout", { body: { plan: planId } });
      window.location.href = url; // pagina di pagamento sicura di Stripe
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <>
      <button className={`w-full ${highlight ? btn.accent : btn.secondary}`} onClick={buy} disabled={loading || !enabled}>
        {loading ? "Apertura pagamento…" : enabled ? "Acquista" : "Presto disponibile"}
      </button>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </>
  );
}
