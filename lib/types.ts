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
  user_id: string;
  target_size: TargetSize;
  target_country: string;
  company_limit: number;
  credit_used_at: string | null;
};

export const TARGET_SIZES = [
  { value: "piccole", label: "Piccole", hint: "brand emergenti, fino a ~10 persone" },
  { value: "medie", label: "Medie", hint: "brand affermati, 10-250 persone" },
  { value: "grandi", label: "Grandi", hint: "leader di mercato" },
  { value: "tutte", label: "Tutte", hint: "mix di dimensioni" },
] as const;
export type TargetSize = (typeof TARGET_SIZES)[number]["value"];

export type ContactChannel = { type: string; label: string; url?: string; person?: string; role?: string; source?: "web" };
export type ContactPlan = {
  channel_type: string;
  channel_label: string;
  why: string;
  steps: string[];
  opening_angle: string;
  person_name?: string;
  person_role?: string;
};

/** Persone chiave trovate sul sito (founder, marketing, commerciale...), una volta ciascuna. */
export function keyPeople(channels: ContactChannel[] | null): { name: string; role: string; channels: ContactChannel[] }[] {
  const out: { name: string; role: string; channels: ContactChannel[] }[] = [];
  for (const c of channels ?? []) {
    if (!c.person) continue;
    let p = out.find((x) => x.name === c.person);
    if (!p) out.push((p = { name: c.person, role: c.role ?? "", channels: [] }));
    p.channels.push(c);
  }
  return out;
}

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
  source: "ricerca" | "manuale";
  size_estimate: string | null;
  discovery_reason: string | null;
  contact_channels: ContactChannel[] | null;
  contact_plan: ContactPlan | null;
  last_contacted_at: string | null;
  next_followup_at: string | null;
  followup_step: number;
  drafts: Record<string, { generated_at: string; messages: { channel: string; subject?: string; body: string }[] }> | null;
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

/** Esempio generico usato nei placeholder dei form. */
export const EXAMPLE = {
  name: "Foto prodotto AI – E-commerce moda",
  product:
    "Un servizio di foto e video prodotto realizzati con l'AI per e-commerce di moda: schede prodotto più ricche in 48 ore, a una frazione del costo di uno shooting.",
  customer: "E-commerce di moda e accessori con più di 100 prodotti a catalogo.",
  sector: "Moda e accessori online",
  country: "Italia",
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
