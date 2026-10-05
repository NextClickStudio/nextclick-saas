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

/** Cambio piano per chi ha già un abbonamento: conferma, poi Stripe calcola la differenza. */
export function ChangePlanButton({ planId, planName, upgrade, highlight }: { planId: string; planName: string; upgrade: boolean; highlight: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function change() {
    const note = upgrade
      ? "Paghi subito solo la differenza per i giorni rimasti di questo mese e ricevi subito le sessioni in più."
      : "La differenza resta come credito sui prossimi rinnovi; le sessioni di questo mese scendono al massimo del nuovo piano.";
    if (!window.confirm(`Passare al piano ${planName}?\n\n${note}`)) return;
    setLoading(true);
    setError("");
    try {
      await api("/api/app/change-plan", { body: { plan: planId } });
      window.location.reload();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }
  return (
    <>
      <button className={`w-full ${highlight ? btn.accent : btn.secondary}`} onClick={change} disabled={loading}>
        {loading ? "Cambio piano…" : `Passa a ${planName}`}
      </button>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </>
  );
}
