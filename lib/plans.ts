// Piani in abbonamento mensile + sessione extra. Modifica qui prezzi e limiti: il resto dell'app si aggiorna da solo.
// 1 sessione = ricerca automatica delle aziende + analisi + report + persone chiave + messaggi.

export type PlanId = "basic" | "pro" | "agency";

export type Plan = {
  id: PlanId;
  name: string;
  priceCents: number; // al mese, IVA esclusa
  sessions: number; // sessioni incluse ogni mese
  radarPerDay: number; // ricerche Radar al giorno
  highlight?: boolean;
  features: string[];
};

export const COMPANIES_PER_SESSION = 30;
export const COMPANIES_PER_FREE_SESSION = 10;
/** Ricerche Radar di prova nel piano gratuito (in totale, non al giorno). */
export const FREE_RADAR_RUNS = 3;

export const PLANS: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    priceCents: 2900,
    sessions: 2,
    radarPerDay: 1,
    features: [
      `2 sessioni al mese (${2 * COMPANIES_PER_SESSION} aziende)`,
      "Analisi, report e persone chiave",
      "Messaggi scritti dall'AI e follow-up",
      "Sai chi apre la tua proposta",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceCents: 5900,
    sessions: 5,
    radarPerDay: 2,
    highlight: true,
    features: [
      `5 sessioni al mese (${5 * COMPANIES_PER_SESSION} aziende)`,
      "Tutto del Basic",
      "Più aziende ogni mese per più settori",
      "Export CSV e classifica pubblica",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    priceCents: 12900,
    sessions: 12,
    radarPerDay: 2,
    features: [
      `12 sessioni al mese (${12 * COMPANIES_PER_SESSION} aziende)`,
      "Tutto del Pro",
      "Ideale per più clienti o settori",
      "Supporto prioritario",
    ],
  },
];

/** Sessione extra, acquistabile in qualsiasi momento (non scade). */
export const EXTRA_SESSION = { priceCents: 900, sessions: 1 };

export function findPlan(id: string | null | undefined): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: cents % 100 ? 2 : 0 });
}

/** Abbonamento che dà diritto alle sessioni e al Radar (anche durante un pagamento in ritardo). */
export function planActive(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

/** Ricerche Radar: col piano attivo N al giorno, in prova un numero fisso in tutto. */
export function radarAllowance(a: { unlimited: boolean; plan: string; plan_status: string | null }): { daily: number } | { trial: true } {
  if (a.unlimited) return { daily: 2 };
  const plan = planActive(a.plan_status) ? findPlan(a.plan) : undefined;
  return plan ? { daily: plan.radarPerDay } : { trial: true };
}

/** Export CSV e classifica pubblica: inclusi da Pro in su (e per gli account interni). */
export function hasProFeatures(a: { unlimited: boolean; plan: string; plan_status: string | null }): boolean {
  if (a.unlimited) return true;
  return planActive(a.plan_status) && (a.plan === "pro" || a.plan === "agency");
}

export const PRO_ONLY_MESSAGE = "Export CSV e classifica pubblica sono inclusi nei piani Pro e Agency: puoi cambiare piano dalla pagina Piani.";
