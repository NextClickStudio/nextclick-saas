import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { findPlan, formatEuro, planActive } from "@/lib/plans";
import { AI_DAILY_LIMITS, type AiKind } from "@/lib/quota";
import { getAccount, getCurrentUser, type Account } from "@/lib/supabase-auth";

export const metadata: Metadata = { title: "Admin" };

/** Costo AI stimato per singola operazione, in euro (vedi calcolo costi di Gemini). */
const AI_COST_EUR: Record<AiKind, number> = {
  analyze: 0.07, // analisi sito + persone chiave
  draft: 0.02,
  people: 0.03,
  discover: 0.08,
  criteria: 0.01,
  reply: 0.005,
  suggest: 0.01,
  meme: 0.01,
  radar: 0.06,
};

const KIND_LABEL: Record<AiKind, string> = {
  analyze: "Analisi siti",
  draft: "Messaggi",
  people: "Ricerca persone",
  discover: "Ricerca aziende",
  criteria: "Criteri",
  reply: "Commenti Radar",
  suggest: "Profilo Radar",
  meme: "Meme",
  radar: "Ricerche Radar",
};

const FIXED_MONTHLY_EUR = 44; // Vercel Pro + Supabase Pro + dominio

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const isoDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
const eur = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </Card>
  );
}

// Numeri del business, visibili solo agli account interni.
export default async function AdminPage() {
  const me = (await getCurrentUser())!;
  if (!(await getAccount(me.id)).unlimited) notFound();

  const since30 = daysAgo(30);
  const [{ data: accountsData }, { data: usersData }, { data: usage }, { data: purchases }, { data: projects }, { data: reports }, { count: messages30 }] =
    await Promise.all([
      db().from("accounts").select("*"),
      db().auth.admin.listUsers({ perPage: 1000 }),
      db().from("ai_usage").select("user_id, day, kind, count").gte("day", isoDay(since30)),
      db().from("purchases").select("user_id, plan, amount_cents, status, paid_at").eq("status", "paid").gte("paid_at", since30.toISOString()),
      db().from("projects").select("user_id, credit_used_at").not("credit_used_at", "is", null),
      db().from("reports").select("view_count, first_viewed_at").gt("view_count", 0),
      db().from("messages").select("id", { count: "exact", head: true }).gte("sent_at", since30.toISOString()),
    ]);

  const accounts = (accountsData ?? []) as Account[];
  const customers = accounts.filter((a) => !a.unlimited);
  const emails = new Map((usersData?.users ?? []).map((u) => [u.id, { email: u.email ?? "", lastSignIn: u.last_sign_in_at ?? null }]));

  // iscritti
  const newIn = (days: number) => customers.filter((a) => new Date(a.created_at) >= daysAgo(days)).length;

  // abbonati e ricavi ricorrenti
  const paying = customers.filter((a) => planActive(a.plan_status) && findPlan(a.plan));
  const mrrCents = paying.reduce((sum, a) => sum + (findPlan(a.plan)?.priceCents ?? 0), 0);
  const byPlan = new Map<string, number>();
  for (const a of paying) byPlan.set(a.plan, (byPlan.get(a.plan) ?? 0) + 1);
  const revenue30 = (purchases ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);

  // attivazione: chi ha usato almeno una sessione
  const sessionsByUser = new Map<string, number>();
  for (const p of projects ?? []) sessionsByUser.set(p.user_id, (sessionsByUser.get(p.user_id) ?? 0) + 1);
  const activated = customers.filter((a) => sessionsByUser.has(a.user_id)).length;
  const conversion = customers.length ? Math.round((paying.length / customers.length) * 100) : 0;

  // costi AI stimati
  const internal = new Set(accounts.filter((a) => a.unlimited).map((a) => a.user_id));
  const today = isoDay(new Date());
  const costByKind = new Map<AiKind, { count: number; eur: number }>();
  const costByUser = new Map<string, number>();
  let aiToday = 0;
  let aiInternal = 0;
  for (const u of usage ?? []) {
    const kind = u.kind as AiKind;
    if (!(kind in AI_COST_EUR)) continue;
    const cost = u.count * AI_COST_EUR[kind];
    const row = costByKind.get(kind) ?? { count: 0, eur: 0 };
    row.count += u.count;
    row.eur += cost;
    costByKind.set(kind, row);
    costByUser.set(u.user_id, (costByUser.get(u.user_id) ?? 0) + cost);
    if (u.day === today) aiToday += cost;
    if (internal.has(u.user_id)) aiInternal += cost;
  }
  const ai30 = [...costByKind.values()].reduce((s, r) => s + r.eur, 0);
  const stripeFees = (purchases ?? []).reduce((s, p) => s + (p.amount_cents ?? 0) * 0.015 + 25, 0) / 100;
  const margin30 = revenue30 / 100 - ai30 - stripeFees - FIXED_MONTHLY_EUR;

  const reportsOpened = (reports ?? []).length;
  const recent = [...customers].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 40);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-zinc-500">Solo per te · ultimi 30 giorni dove non indicato</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Admin</h1>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Iscritti totali" value={customers.length} hint={`+${newIn(1)} oggi · +${newIn(7)} in 7 giorni`} />
        <Stat label="Abbonati attivi" value={paying.length} hint={[...byPlan].map(([p, n]) => `${findPlan(p)?.name} ${n}`).join(" · ") || "nessuno"} />
        <Stat label="Ricavo mensile ricorrente" value={formatEuro(mrrCents)} hint="IVA esclusa" />
        <Stat label="Conversione prova → piano" value={`${conversion}%`} hint={`${activated} hanno usato almeno una sessione`} />
        <Stat label="Incassato (30 gg)" value={formatEuro(revenue30)} hint={`commissioni Stripe ~${eur(stripeFees)}`} />
        <Stat label="Costo AI stimato (30 gg)" value={eur(ai30)} hint={`oggi ${eur(aiToday)} · tuo uso interno ${eur(aiInternal)}`} />
        <Stat label="Margine stimato (30 gg)" value={eur(margin30)} hint={`dopo AI, Stripe e ${FIXED_MONTHLY_EUR} € di costi fissi`} />
        <Stat label="Messaggi inviati (30 gg)" value={messages30 ?? 0} hint={`${reportsOpened} report aperti in totale`} />
      </section>

      <Card>
        <h2 className="mb-3 font-semibold text-white">Uso dell&apos;AI (30 giorni)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-1.5 pr-4 font-medium">Operazione</th>
                <th className="py-1.5 pr-4 font-medium">Volte</th>
                <th className="py-1.5 pr-4 font-medium">Costo stimato</th>
                <th className="py-1.5 font-medium">Limite al giorno per utente</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {(Object.keys(AI_COST_EUR) as AiKind[]).map((k) => (
                <tr key={k} className="border-t border-white/[0.05]">
                  <td className="py-1.5 pr-4">{KIND_LABEL[k]}</td>
                  <td className="py-1.5 pr-4">{costByKind.get(k)?.count ?? 0}</td>
                  <td className="py-1.5 pr-4">{eur(costByKind.get(k)?.eur ?? 0)}</td>
                  <td className="py-1.5 text-zinc-500">{AI_DAILY_LIMITS[k]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-white">Ultimi iscritti</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-1.5 pr-4 font-medium">Utente</th>
                <th className="py-1.5 pr-4 font-medium">Piano</th>
                <th className="py-1.5 pr-4 font-medium">Sessioni usate</th>
                <th className="py-1.5 pr-4 font-medium">Costo AI (30 gg)</th>
                <th className="py-1.5 pr-4 font-medium">Iscritto</th>
                <th className="py-1.5 font-medium">Ultimo accesso</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {recent.map((a) => {
                const u = emails.get(a.user_id);
                const plan = findPlan(a.plan);
                const active = planActive(a.plan_status) && plan;
                return (
                  <tr key={a.user_id} className="border-t border-white/[0.05]">
                    <td className="py-1.5 pr-4">
                      <div className="text-white">{a.full_name || "—"}</div>
                      <div className="text-xs text-zinc-500">
                        {u?.email}
                        {a.company_name ? ` · ${a.company_name}` : ""}
                      </div>
                    </td>
                    <td className="py-1.5 pr-4">
                      {active ? (
                        <Badge tone={a.plan_status === "past_due" ? "amber" : "green"}>
                          {plan!.name}
                          {a.plan_status === "past_due" ? " · pagamento in ritardo" : ""}
                        </Badge>
                      ) : (
                        <Badge>prova</Badge>
                      )}
                    </td>
                    <td className="py-1.5 pr-4">{sessionsByUser.get(a.user_id) ?? 0}</td>
                    <td className="py-1.5 pr-4">{eur(costByUser.get(a.user_id) ?? 0)}</td>
                    <td className="py-1.5 pr-4 text-zinc-500">{new Date(a.created_at).toLocaleDateString("it-IT")}</td>
                    <td className="py-1.5 text-zinc-500">{u?.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString("it-IT") : "—"}</td>
                  </tr>
                );
              })}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-zinc-500">Ancora nessun iscritto oltre a te.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-zinc-500">
        I costi AI sono stime per operazione: il costo reale è nella console di Google Cloud (fatturazione Gemini).
      </p>
    </div>
  );
}
