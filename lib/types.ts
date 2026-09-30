// Tipi condivisi tra server e client (nessun segreto qui dentro).

export const COMPANY_STATUSES = [
  { value: "da_contattare", label: "Da contattare" },
  { value: "contattata", label: "Contattata" },
  { value: "report_aperto", label: "Ha aperto il report" },
  { value: "ha_risposto", label: "Ha risposto" },
  { value: "chiamata", label: "Chiamata" },
  { value: "cliente", label: "Cliente" },
  { value: "non_interessata", label: "Non interessata" },
] as const;

export type CompanyStatus = (typeof COMPANY_STATUSES)[number]["value"];
export const STATUS_VALUES = COMPANY_STATUSES.map((s) => s.value) as [CompanyStatus, ...CompanyStatus[]];

export function statusLabel(value: string): string {
  return COMPANY_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export type Project = {
  id: string;
  name: string;
  product_description: string;
  target_customer: string;
  target_sector: string;
  symptom: string | null;
  index_name: string | null;
  public_slug: string;
  public_top_n: number;
  public_ranking_enabled: boolean;
  report_cta_text: string;
  report_cta_url: string | null;
  sender_name: string | null;
  created_at: string;
};

export type Criterion = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  how_to_check: string;
  weight: number;
  position: number;
};

export type Score = { criterion_id: string; score: number; evidence: string };
export type WeakPoint = { title: string; explanation: string; evidence: string };
export type PageInfo = { url: string; title: string };

export type Analysis = {
  id: string;
  company_id: string;
  status: "in_attesa" | "in_corso" | "completata" | "errore";
  error_message: string | null;
  pages_analyzed: PageInfo[] | null;
  scores: Score[] | null;
  weak_points: WeakPoint[] | null;
  summary: string | null;
  total_score: number | null;
  analyzed_at: string | null;
  created_at: string;
};

export type Report = {
  id: string;
  company_id: string;
  slug: string;
  view_count: number;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
};

export type Company = {
  id: string;
  project_id: string;
  name: string;
  website_url: string;
  status: CompanyStatus;
  notes: string | null;
  created_at: string;
};

/** Riga "completa" usata nelle tabelle dell'area riservata. */
export type CompanyRow = Company & {
  /** ultima analisi completata (quella valida) */
  analysis: Analysis | null;
  /** ultima analisi in assoluto (per mostrare errori o "in corso") */
  lastAttempt: Analysis | null;
  report: Report | null;
  position: number | null;
};

/** Criterio in modifica nel form (id assente se nuovo). */
export type CriterionDraft = {
  id?: string;
  name: string;
  description: string;
  how_to_check: string;
  weight: number;
};

/** Esempio NextClick usato nei placeholder e nei dati di prova. */
export const EXAMPLE = {
  name: "NextClick – Beauty e integratori",
  product:
    "NextClick Studio: un widget AI per Shopify che fa qualche domanda al cliente e gli consiglia il prodotto giusto, come farebbe una commessa esperta.",
  customer: "E-commerce italiani di beauty e integratori su Shopify, con cataloghi ampi (50+ prodotti).",
  sector: "Beauty e integratori Italia",
};

export function formatDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Europe/Rome",
  });
}
