"use client";

import { useState } from "react";
import { api } from "@/components/client-utils";
import { btn } from "@/components/ui";

export default function BuyButton({ planId, label, highlight, enabled }: { planId: string; label: string; highlight: boolean; enabled: boolean }) {
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
        {loading ? "Apertura pagamento…" : label}
      </button>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </>
  );
}

/** Portale Stripe: carta, fatture, disdetta. */
export function PortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function open() {
    setLoading(true);
    setError("");
    try {
      const { url } = await api<{ url: string }>("/api/app/billing-portal", { body: {} });
      window.location.href = url;
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }
  return (
    <div>
      <button className={btn.secondary} onClick={open} disabled={loading}>{loading ? "Apertura…" : "Gestisci abbonamento"}</button>
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}
