// Piani a pagamento. Modifica qui prezzi e crediti: il resto dell'app si aggiorna da solo.
// 1 credito = 1 sessione: ricerca automatica delle aziende + analisi + report + metodo di contatto.

export type Plan = {
  id: "starter" | "growth" | "scale";
  name: string;
  priceCents: number; // prezzo in centesimi di euro, IVA esclusa
  credits: number;
  perSession: string;
  highlight?: boolean;
  features: string[];
};

export const COMPANIES_PER_SESSION = 30;
export const COMPANIES_PER_FREE_SESSION = 10;

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    priceCents: 3900,
    credits: 3,
    perSession: "13 € a sessione",
    features: ["3 sessioni", `Fino a ${COMPANIES_PER_SESSION} aziende per sessione`, "Report privati illimitati", "Classifica pubblica"],
  },
  {
    id: "growth",
    name: "Growth",
    priceCents: 9900,
    credits: 10,
    perSession: "9,90 € a sessione",
    highlight: true,
    features: ["10 sessioni", `Fino a ${COMPANIES_PER_SESSION} aziende per sessione`, "Metodo di contatto per ogni azienda", "Export CSV"],
  },
  {
    id: "scale",
    name: "Scale",
    priceCents: 24900,
    credits: 30,
    perSession: "8,30 € a sessione",
    features: ["30 sessioni", `Fino a ${COMPANIES_PER_SESSION} aziende per sessione`, "Tutte le funzioni", "Supporto prioritario"],
  },
];

export function findPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: cents % 100 ? 2 : 0 });
}
